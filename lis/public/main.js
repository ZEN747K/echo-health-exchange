
document.addEventListener('DOMContentLoaded', () => {
    const requestsList = document.getElementById('requests-list');
    const refreshRequestsBtn = document.getElementById('refresh-requests');
    const resultFormContainer = document.getElementById('result-form-container');
    const resultForm = document.getElementById('result-form');
    const cancelResultBtn = document.getElementById('cancel-result');
    const statusMessage = document.getElementById('status-message');
    
    let currentRequests = [];
    
    // Fetch lab requests from FHIR server
    async function fetchLabRequests() {
        requestsList.innerHTML = '<tr><td colspan="6" class="no-data">Loading laboratory requests...</td></tr>';
        
        try {
            const response = await fetch('/api/lab-requests');
            const data = await response.json();
            
            currentRequests = data.labRequests || [];
            
            if (currentRequests.length === 0) {
                requestsList.innerHTML = '<tr><td colspan="6" class="no-data">No pending laboratory requests found.</td></tr>';
                return;
            }
            
            displayRequests(currentRequests);
            
        } catch (error) {
            console.error('Error fetching lab requests:', error);
            requestsList.innerHTML = '<tr><td colspan="6" class="no-data">Error loading laboratory requests. Please try again.</td></tr>';
        }
    }
    
    function displayRequests(requests) {
        requestsList.innerHTML = '';
        
        requests.forEach(request => {
            const statusClass = request.status === 'active' ? 'status-active' : 'status-completed';
            const testsText = request.tests.map(test => test.name).join(', ');
            
            // Extract patient details from extensions
            let patientAge = '';
            let patientGender = '';
            let patientWeight = '';
            
            if (request.extensions) {
                const ageExt = request.extensions.find(ext => ext.url === 'http://his.org/fhir/extension/patient-age');
                const genderExt = request.extensions.find(ext => ext.url === 'http://his.org/fhir/extension/patient-gender');
                const weightExt = request.extensions.find(ext => ext.url === 'http://his.org/fhir/extension/patient-weight');
                
                patientAge = ageExt ? ageExt.valueInteger : '';
                patientGender = genderExt ? genderExt.valueString : '';
                patientWeight = weightExt ? weightExt.valueDecimal : '';
            }
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${request.patientName}<br>
                    <small>ID: ${request.patientId}</small>
                    ${patientAge ? `<br><small>Age: ${patientAge}</small>` : ''}
                    ${patientGender ? `<br><small>Gender: ${patientGender}</small>` : ''}
                    ${patientWeight ? `<br><small>Weight: ${patientWeight} kg</small>` : ''}
                </td>
                <td>${request.doctorName}</td>
                <td>
                    <ul class="test-list">
                        ${request.tests.map(test => `<li>${test.name}</li>`).join('')}
                    </ul>
                </td>
                <td><span class="status-pill ${statusClass}">${request.status}</span></td>
                <td>
                    ${request.status === 'active' ? 
                        `<button class="btn-action" data-request-id="${request.id}">Enter Results</button>` :
                        `<button class="btn-action disabled" disabled>Completed</button>`
                    }
                </td>
            `;
            
            requestsList.appendChild(row);
            
            // Add event listener to the button if status is active
            if (request.status === 'active') {
                const actionBtn = row.querySelector('.btn-action');
                actionBtn.addEventListener('click', () => {
                    openResultForm(request);
                });
            }
        });
    }
    
    function openResultForm(request) {
        // Set hidden input value
        document.getElementById('request-id').value = request.id;
        document.getElementById('patient-name').value = request.patientName;
        
        // Extract patient details from extensions
        let patientAge = '';
        let patientGender = '';
        let patientWeight = '';
        
        if (request.extensions) {
            const ageExt = request.extensions.find(ext => ext.url === 'http://his.org/fhir/extension/patient-age');
            const genderExt = request.extensions.find(ext => ext.url === 'http://his.org/fhir/extension/patient-gender');
            const weightExt = request.extensions.find(ext => ext.url === 'http://his.org/fhir/extension/patient-weight');
            
            patientAge = ageExt ? ageExt.valueInteger : '';
            patientGender = genderExt ? genderExt.valueString : '';
            patientWeight = weightExt ? weightExt.valueDecimal : '';
        }
        
        // Display patient details
        const patientDetailsEl = document.getElementById('patient-details');
        patientDetailsEl.innerHTML = '';
        
        if (patientAge || patientGender || patientWeight) {
            const detailsHtml = [];
            if (patientAge) detailsHtml.push(`Age: ${patientAge}`);
            if (patientGender) detailsHtml.push(`Gender: ${patientGender}`);
            if (patientWeight) detailsHtml.push(`Weight: ${patientWeight} kg`);
            
            patientDetailsEl.innerHTML = detailsHtml.join(' | ');
        }
        
        // Generate test result inputs
        const testResultsContainer = document.getElementById('test-results-container');
        testResultsContainer.innerHTML = '';
        
        request.tests.forEach((test, index) => {
            const testDiv = document.createElement('div');
            testDiv.className = 'test-result-item';
            testDiv.innerHTML = `
                <h4>${test.name}</h4>
                <div class="test-result-grid">
                    <div class="form-group">
                        <label for="test-${index}-value">Result Value:</label>
                        <input type="text" id="test-${index}-value" name="test-${index}-value" required data-test-code="${test.code}" data-test-name="${test.name}">
                    </div>
                    <div class="form-group">
                        <label for="test-${index}-unit">Unit:</label>
                        <input type="text" id="test-${index}-unit" name="test-${index}-unit" required>
                    </div>
                    <div class="form-group">
                        <label for="test-${index}-interpretation">Interpretation:</label>
                        <select id="test-${index}-interpretation" name="test-${index}-interpretation" required>
                            <option value="">Select...</option>
                            <option value="Normal">Normal</option>
                            <option value="High">High</option>
                            <option value="Low">Low</option>
                            <option value="Abnormal">Abnormal</option>
                            <option value="Critical high">Critical high</option>
                            <option value="Critical low">Critical low</option>
                        </select>
                    </div>
                </div>
                <div class="form-group">
                    <label for="test-${index}-note">Notes:</label>
                    <textarea id="test-${index}-note" name="test-${index}-note" rows="2"></textarea>
                </div>
            `;
            
            testResultsContainer.appendChild(testDiv);
        });
        
        // Show the form
        resultFormContainer.classList.remove('hidden');
        
        // Scroll to the form
        resultFormContainer.scrollIntoView({ behavior: 'smooth' });
    }
    
    // Handle submit of the result form
    resultForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const requestId = document.getElementById('request-id').value;
        const patientName = document.getElementById('patient-name').value;
        const conclusion = document.getElementById('conclusion').value;
        
        // Extract test results
        const testResults = [];
        const testInputs = document.querySelectorAll('[id^="test-"][id$="-value"]');
        
        testInputs.forEach(input => {
            const index = input.id.split('-')[1];
            const testCode = input.getAttribute('data-test-code');
            const testName = input.getAttribute('data-test-name');
            const value = input.value;
            const unit = document.getElementById(`test-${index}-unit`).value;
            const interpretation = document.getElementById(`test-${index}-interpretation`).value;
            const note = document.getElementById(`test-${index}-note`).value;
            
            testResults.push({
                code: testCode,
                name: testName,
                value,
                unit,
                interpretation,
                note
            });
        });
        
        try {
            // Submit to server
            const response = await fetch('/api/lab-results', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    requestId,
                    patientName,
                    testResults,
                    conclusion
                })
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Failed to submit lab results');
            }
            
            // Show success message
            showStatus('Lab results submitted successfully!', 'success');
            
            // Reset and close the form
            resultForm.reset();
            resultFormContainer.classList.add('hidden');
            
            // Refresh the list
            fetchLabRequests();
            
        } catch (error) {
            console.error('Error submitting lab results:', error);
            showStatus('Error submitting lab results. Please try again.', 'error');
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
    
    // Cancel button event
    cancelResultBtn.addEventListener('click', () => {
        resultForm.reset();
        resultFormContainer.classList.add('hidden');
    });
    
    // Refresh button event
    refreshRequestsBtn.addEventListener('click', fetchLabRequests);
    
    // Initial fetch of lab requests
    fetchLabRequests();
});
