
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
    user: process.env.MYSQL_USER || 'his_user',
    password: process.env.MYSQL_PASSWORD || 'his_password',
    database: process.env.MYSQL_DATABASE || 'his_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// FHIR Server URL
const FHIR_SERVER_URL = process.env.FHIR_SERVER_URL || 'http://localhost:8083/fhir';

// Function to generate patient ID
function generatePatientId(patientName, testList, doctorName, day, month, year) {   
    if (!patientName || !testList || !doctorName || !day || !month || !year) {
         return 'Unknown';
     }
     const patientPart = patientName.substring(0, 3).toUpperCase();
     const testCount = testList.length.toString();
     const doctorPart = doctorName.substring(0, 3).toUpperCase();
     const dayStr = day.toString().padStart(2, '0');
    const monthStr = month.toString().padStart(2, '0');
    const yearStr = year.toString();

    return `${patientPart}${testCount}${doctorPart}${dayStr}${monthStr}${yearStr}`;
}


// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
    console.log('GET /: Request received', { query: req.query });
});

// Create a new lab request
app.post('/api/lab-requests', async (req, res) => {
    console.log('POST /api/lab-requests: Request received', { body: req.body });

    const today = new Date();
    const day = today.getDate();
    const month = today.getMonth() + 1; // Month is 0-indexed
    const year = today.getFullYear();

    // Generate patient ID if not provided
    if (!req.body.patientId) {
        req.body.patientId = generatePatientId(req.body.patientName, req.body.testList, req.body.doctorName, day, month, year);
        console.log('New generated patientId:', req.body.patientId);
    } else {
        console.log('patientId was provided:', req.body.patientId);
    }
    const { patientName, patientId, patientAge, patientGender, patientWeight, doctorName, testList } = req.body;
    
    if (!patientName || !doctorName || !testList || testList.length === 0) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    try {

        // Log the request to the HIS database
        const connection = await pool.getConnection();
        const [result] = await connection.execute(
            'INSERT INTO lab_requests (patient_name, patient_id, patient_age, patient_gender, patient_weight, doctor_name, test_list, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                patientName, 
                patientId || 'Unknown', 
                patientAge || null, 
                patientGender || null, 
                patientWeight || null, 
                doctorName, 
                JSON.stringify(testList), 
                'PENDING'
            ]
        );
        connection.release();
        
        const requestId = result.insertId;
        
        // Create FHIR ServiceRequest resource
        const serviceRequest = {
            resourceType: 'ServiceRequest',
            status: 'active',
            intent: 'order',
            subject: {
                display: patientName,
                identifier: {
                    value: patientId || 'Unknown'
                }
            },
            requester: {
                display: doctorName
            },
            code: {
                text: 'Laboratory tests',
                coding: testList.map(test => ({
                    system: 'http://loinc.org',
                    code: test.code || 'unknown',
                    display: test.name
                }))
            },
            identifier: [{
                system: 'http://his.org/lab-requests',
                value: `HIS-LR-${requestId}`
            }]
        };
        
        // Add additional patient details if provided
        if (patientAge || patientGender || patientWeight) {
            serviceRequest.extension = [];
            
            if (patientAge) {
                serviceRequest.extension.push({
                    url: "http://his.org/fhir/extension/patient-age",
                    valueInteger: parseInt(patientAge)
                });
            }
            
            if (patientGender) {
                serviceRequest.extension.push({
                    url: "http://his.org/fhir/extension/patient-gender",
                    valueString: patientGender
                });
            }
            
            if (patientWeight) {
                serviceRequest.extension.push({
                    url: "http://his.org/fhir/extension/patient-weight",
                    valueDecimal: parseFloat(patientWeight)
                });
            }
        }
        
        // Send ServiceRequest to FHIR server
        const fhirResponse = await axios.post(`${FHIR_SERVER_URL}/ServiceRequest`, serviceRequest, {
            headers: {
                'Content-Type': 'application/fhir+json'
            }
        });
        
        // Update the lab request with FHIR ID
        await connection.execute(
            'UPDATE lab_requests SET fhir_id = ? WHERE id = ?',
            [fhirResponse.data.id, requestId]
        );
        
        res.status(201).json({
            message: 'Lab request created successfully',
            requestId,
            fhirId: fhirResponse.data.id
        });
        
    } catch (error) {
        console.error('Error creating lab request:', error);
        res.status(500).json({ error: 'Failed to create lab request' });
    }
});

// Get lab results

app.get('/api/lab-results', async (req, res) => {
    try {
        // Query FHIR server for DiagnosticReport resources
        const fhirResponse = await axios.get(`${FHIR_SERVER_URL}/DiagnosticReport`, {
            headers: {
                'Accept': 'application/fhir+json'
            }
        });
        
        console.log('GET /api/lab-results: FHIR Response', { body: fhirResponse.data });

        const diagnosticReports = fhirResponse.data.entry || [];
        const labResults = diagnosticReports.map(entry => {
            const report = entry.resource;
            return {
                id: report.id,
                patientName: report.subject?.display || 'Unknown',
                status: report.status,
                conclusion: report.conclusion,
                effectiveDate: report.effectiveDateTime,
                results: report.result?.map(r => r.display) || []
            };
        });
        
        res.json({ labResults });
        
    } catch (error) {
        console.error('Error fetching lab results:', error);
        res.status(500).json({ error: 'Failed to fetch lab results' });
    }
});


// Start the server
app.listen(PORT, () => {
    console.log(`HIS server running on port ${PORT}`);
});
