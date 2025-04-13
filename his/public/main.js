
document.addEventListener('DOMContentLoaded', () => {
    // Tab switching logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-tab');
            
            // Remove active class from all buttons and panes
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            // Add active class to clicked button and corresponding pane
            btn.classList.add('active');
            document.getElementById(`${tabId}-tab`).classList.add('active');
        });
    });
    
    // Lab Request Form Submission
    const labRequestForm = document.getElementById('lab-request-form');
    const statusMessage = document.getElementById('status-message');
    
    labRequestForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Get form values
        const patientName = document.getElementById('patientName').value;
        const patientId = document.getElementById('patientId').value;
        const patientAge = document.getElementById('patientAge').value;
        const patientGender = document.getElementById('patientGender').value;
        const patientWeight = document.getElementById('patientWeight').value;
        const doctorName = document.getElementById('doctorName').value;
        
        // Get selected tests
        const selectedTests = Array.from(document.querySelectorAll('input[name="tests"]:checked'))
            .map(checkbox => {
                return {
                    code: checkbox.value,
                    name: checkbox.nextElementSibling.textContent.trim()
                };
            });
            
        if (selectedTests.length === 0) {
            showStatus('Please select at least one laboratory test.', 'error');
            return;
        }
        
        try {
            // Send to server
            const response = await fetch('/api/lab-requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    patientName,
                    patientId,
                    patientAge,
                    patientGender,
                    patientWeight,
                    doctorName,
                    testList: selectedTests
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to create lab request');
            }
            
            // Show success message
            showStatus('Laboratory request sent successfully!', 'success');
            labRequestForm.reset();
            
        } catch (error) {
            console.error('Error submitting lab request:', error);
            showStatus('Error sending laboratory request. Please try again.', 'error');
        }
    });
    
    function showStatus(message, type) {
        statusMessage.textContent = message;
        statusMessage.className = 'status-message';
        statusMessage.classList.add(type);
        
        // Auto hide after 5 seconds
        setTimeout(() => {
            statusMessage.className = 'status-message';
        }, 5000);
    }
    
    // Fetch and display lab results
    const refreshResultsBtn = document.getElementById('refresh-results');
    const resultsList = document.getElementById('results-list');
    const searchResultsInput = document.getElementById('search-results');
    
    refreshResultsBtn.addEventListener('click', fetchLabResults);
    searchResultsInput.addEventListener('input', filterResults);
    
    let allLabResults = [];
    
    async function fetchLabResults() {
        resultsList.innerHTML = '<p class="no-results">Loading lab results...</p>';
        
        try {
            const response = await fetch('/api/lab-results');
            const data = await response.json();
            
            allLabResults = data.labResults || [];
            
            if (allLabResults.length === 0) {
                resultsList.innerHTML = '<p class="no-results">No lab results found.</p>';
                return;
            }
            
            displayResults(allLabResults);
            
        } catch (error) {
            console.error('Error fetching lab results:', error);
            resultsList.innerHTML = '<p class="no-results">Error loading lab results. Please try again.</p>';
        }
    }
    
    function displayResults(results) {
        if (results.length === 0) {
            resultsList.innerHTML = '<p class="no-results">No matching results found.</p>';
            return;
        }
        
        resultsList.innerHTML = '';
        
        results.forEach(result => {
            const resultCard = document.createElement('div');
            resultCard.className = 'result-card';
            
            const statusClass = result.status === 'final' ? 'completed' : 'preliminary';
            const effectiveDate = result.effectiveDate ? new Date(result.effectiveDate).toLocaleDateString() : 'Unknown date';
            
            resultCard.innerHTML = `
                <h3>Results for ${result.patientName}</h3>
                <div class="result-meta">
                    Date: ${effectiveDate}
                    <span class="result-status ${statusClass}">${result.status}</span>
                </div>
                <div class="result-content">
                    ${result.conclusion ? `<p class="result-conclusion">Conclusion: ${result.conclusion}</p>` : ''}
                    ${result.results && result.results.length > 0 ? `
                        <div class="result-tests">
                            <strong>Tests Results:</strong>
                            <ul>
                                ${result.results.map(test => `<li>${test}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
            
            resultsList.appendChild(resultCard);
        });
    }
    
    function filterResults() {
        const searchTerm = searchResultsInput.value.toLowerCase();
        
        if (!searchTerm.trim()) {
            displayResults(allLabResults);
            return;
        }
        
        const filteredResults = allLabResults.filter(result => 
            result.patientName.toLowerCase().includes(searchTerm)
        );
        
        displayResults(filteredResults);
    }
    
    // Initial fetch of lab results when viewing the results tab
    document.querySelector('[data-tab="results"]').addEventListener('click', () => {
        if (allLabResults.length === 0) {
            fetchLabResults();
        }
    });
});
