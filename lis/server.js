const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = 80;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Database connection pool
const pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'lis_user',
    password: process.env.MYSQL_PASSWORD || 'lis_password',
    database: process.env.MYSQL_DATABASE || 'lis_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// FHIR Server URL
const FHIR_SERVER_URL = process.env.FHIR_SERVER_URL || 'http://localhost:8083/fhir';

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Get pending lab requests
app.get('/api/lab-requests', async (req, res) => {
    try {
        // Query FHIR server for ServiceRequest resources
        const fhirResponse = await axios.get(`${FHIR_SERVER_URL}/ServiceRequest`, {
            headers: {
                'Accept': 'application/fhir+json'
            }
        });
        
        const serviceRequests = fhirResponse.data.entry || [];
        const labRequests = serviceRequests.map(entry => {
            const request = entry.resource;
            
            // Extract test list from the coding array
            const tests = request.code?.coding?.map(coding => ({
                code: coding.code,
                name: coding.display
            })) || [];
            
            // Extract patient details from extensions
            const extensions = request.extension || [];
            
            return {
                id: request.id,
                patientName: request.subject?.display || 'Unknown',
                patientId: request.subject?.identifier?.value || 'Unknown',
                doctorName: request.requester?.display || 'Unknown',
                tests,
                status: request.status,
                priority: request.priority || 'routine',
                created: request.authoredOn,
                extensions: extensions
            };
        });
        
        res.json({ labRequests });
        
    } catch (error) {
        console.error('Error fetching lab requests:', error);
        res.status(500).json({ error: 'Failed to fetch lab requests' });
    }
});

// Submit lab results
app.post('/api/lab-results', async (req, res) => {
    const { requestId, patientName, testResults, conclusion, status } = req.body;
    
    if (!requestId || !patientName || !testResults || testResults.length === 0) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        console.log("Received lab result submission:", { requestId, patientName, status, testResults });
        
        // Log the result to the LIS database
        const connection = await pool.getConnection();
        const [result] = await connection.execute(
            'INSERT INTO lab_results (request_id, patient_name, result_data, conclusion, status) VALUES (?, ?, ?, ?, ?)',
            [requestId, patientName, JSON.stringify(testResults), conclusion, status || 'FINAL']
        );
        connection.release();
        
        const resultId = result.insertId;
        
        // Create FHIR DiagnosticReport resource
        const diagnosticReport = {
            resourceType: 'DiagnosticReport',
            status: 'final',
            code: {
                text: 'Laboratory Report'
            },
            subject: {
                display: patientName
            },
            effectiveDateTime: new Date().toISOString(),
            issued: new Date().toISOString(),
            result: testResults.map(test => ({
                display: `${test.name}: ${test.value} ${test.unit} - ${test.interpretation}`
            })),
            conclusion: conclusion,
            basedOn: [{
                reference: `ServiceRequest/${requestId}`
            }],
            identifier: [{
                system: 'http://lis.org/lab-results',
                value: `LIS-LR-${resultId}`
            }]
        };
        
        // Send DiagnosticReport to FHIR server
        const fhirResponse = await axios.post(`${FHIR_SERVER_URL}/DiagnosticReport`, diagnosticReport, {
            headers: {
                'Content-Type': 'application/fhir+json'
            }
        });
        
        // Update the lab result with FHIR ID
        const updateConn = await pool.getConnection();
        await updateConn.execute(
            'UPDATE lab_results SET fhir_id = ? WHERE id = ?',
            [fhirResponse.data.id, resultId]
        );
        updateConn.release();
        
        // Update the ServiceRequest status to completed
        try {
            // First GET the current ServiceRequest
            const getRequestResponse = await axios.get(`${FHIR_SERVER_URL}/ServiceRequest/${requestId}`, {
                headers: {
                    'Accept': 'application/fhir+json'
                }
            });
            
            const serviceRequest = getRequestResponse.data;
            
            // Update status to completed
            serviceRequest.status = 'completed';
            
            // PUT updated ServiceRequest back to FHIR server
            await axios.put(`${FHIR_SERVER_URL}/ServiceRequest/${requestId}`, serviceRequest, {
                headers: {
                    'Content-Type': 'application/fhir+json'
                }
            });
            
            console.log("ServiceRequest status updated to completed");
        } catch (updateError) {
            console.error('Error updating ServiceRequest status:', updateError);
            // Continue with response, as we already have the DiagnosticReport created
        }
        
        res.status(201).json({
            message: 'Lab result submitted successfully',
            resultId,
            fhirId: fhirResponse.data.id
        });
        
    } catch (error) {
        console.error('Error submitting lab result:', error);
        res.status(500).json({ error: 'Failed to submit lab result' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`LIS server running on port ${PORT}`);
});
