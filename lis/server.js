
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const axios = require('axios');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 80;

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

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

// API Routes
// Get active lab requests from FHIR server
app.get('/api/lab-requests', async (req, res) => {
    try {
        // Query FHIR server for active ServiceRequest resources
        const fhirResponse = await axios.get(`${FHIR_SERVER_URL}/ServiceRequest?status=active`, {
            headers: {
                'Accept': 'application/fhir+json'
            }
        });
        
        const entries = fhirResponse.data.entry || [];
        const labRequests = entries.map(entry => {
            const request = entry.resource;
            
            // Extract tests from coding array
            const tests = request.code?.coding?.map(coding => ({
                code: coding.code,
                name: coding.display
            })) || [];
            
            return {
                id: request.id,
                patientName: request.subject?.display || 'Unknown',
                patientId: request.subject?.identifier?.value || 'Unknown',
                doctorName: request.requester?.display || 'Unknown',
                status: request.status,
                tests,
                extensions: request.extension
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
    
    if (!requestId || !testResults || testResults.length === 0) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {
        // Create DiagnosticReport resource for FHIR
        const diagnosticReport = {
            resourceType: 'DiagnosticReport',
            status: status || 'final',
            code: {
                text: 'Laboratory Test Results'
            },
            subject: {
                display: patientName
            },
            effectiveDateTime: new Date().toISOString(),
            issued: new Date().toISOString(),
            conclusion: conclusion,
            result: testResults.map(test => ({
                display: `${test.name}: ${test.value} ${test.unit} (${test.interpretation})${test.note ? ' - ' + test.note : ''}`
            }))
        };
        
        // Log the result to LIS database
        const connection = await pool.getConnection();
        const [result] = await connection.execute(
            'INSERT INTO lab_results (request_id, patient_name, test_results, conclusion, status) VALUES (?, ?, ?, ?, ?)',
            [requestId, patientName, JSON.stringify(testResults), conclusion, status]
        );
        connection.release();
        
        // Submit DiagnosticReport to FHIR server
        const fhirResponse = await axios.post(`${FHIR_SERVER_URL}/DiagnosticReport`, diagnosticReport, {
            headers: {
                'Content-Type': 'application/fhir+json'
            }
        });
        
        // Update the ServiceRequest to completed
        await axios.put(`${FHIR_SERVER_URL}/ServiceRequest/${requestId}`, {
            resourceType: 'ServiceRequest',
            id: requestId,
            status: 'completed'
        }, {
            headers: {
                'Content-Type': 'application/fhir+json'
            }
        });
        
        res.status(201).json({
            message: 'Lab results submitted successfully',
            resultId: result.insertId,
            fhirId: fhirResponse.data.id
        });
        
    } catch (error) {
        console.error('Error submitting lab results:', error);
        res.status(500).json({ error: 'Failed to submit lab results' });
    }
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'healthy' });
});

// Start the server
app.listen(PORT, () => {
    console.log(`LIS server running on port ${PORT}`);
});
