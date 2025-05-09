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

// Routes
// Route for serving the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Create a new lab request
app.post('/api/lab-requests', async (req, res) => {
    console.log('app.post(/api/lab-requests) - Function called with arguments:', req.params, req.body);

    let { patientName, patientId, patientAge, patientGender, patientWeight, doctorName, testList } = req.body;
    
    // Check if required fields are provided
    if (!patientName || !doctorName || !testList || testList.length === 0) {
        return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Also check if patientAge is provided when patientId is not provided
    if ((!patientId || patientId.trim() === '') && !patientAge) {
        return res.status(400).json({ error: 'Patient age is required when patient ID is not provided' });
    }
    
    // Modify the request data - Generate default patient ID if not provided
    if (!patientId || patientId.trim() === '') {
        patientId = `${patientName}-${patientAge}`;
        console.log(`Generated default patient ID: ${patientId}`);
        // Update the request body with the new patientId
        req.body.patientId = patientId;
    }
    
    try {
        // Log the request to the HIS database
        const connection = await pool.getConnection();
        const [result] = await connection.execute(
            'INSERT INTO lab_requests (patient_name, patient_id, patient_age, patient_gender, patient_weight, doctor_name, test_list, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [
                patientName, 
                patientId, 
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
                    value: patientId
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
        console.log('Lab request updated: status=PENDING, fhir_id=', fhirResponse.data.id);
        
        res.status(201).json({
            message: 'Lab request created successfully',
            requestId,
            fhirId: fhirResponse.data.id,
            patientId: patientId // Return the generated or provided patientId
        });
        
    } catch (error) {
        console.error('Error creating lab request:', error);
        res.status(500).json({ error: 'Failed to create lab request' });
    }
});

// Get lab dashboard items (pending requests and results)
app.get('/api/lab-dashboard', async (req, res) => {
    console.log(`[${new Date().toISOString()}] app.get('/api/lab-dashboard') - Fetching lab dashboard items.`);
    try {
        const connection = await pool.getConnection();
        // Fetch all lab requests initiated by this HIS, ordered by creation date
        const [hisRequests] = await connection.execute(
            'SELECT id, patient_name, patient_id, patient_age, patient_gender, patient_weight, test_list, doctor_name, status AS local_status, fhir_id, created_at FROM lab_requests ORDER BY created_at DESC'
        );
        // connection.release(); // Release connection later after all FHIR calls if needed, or per request if preferred.

        const dashboardItems = [];

        for (const request of hisRequests) {
            let testListParsed = [];
            try {
                if (typeof request.test_list === 'string') {
                    testListParsed = JSON.parse(request.test_list || '[]');
                } else if (typeof request.test_list === 'object' && request.test_list !== null) {
                    // If it's already an object (and not null), use it directly
                    testListParsed = Array.isArray(request.test_list) ? request.test_list : [];
                }
            } catch (parseError) {
                console.error(`[${new Date().toISOString()}] Error parsing test_list for HIS request ID ${request.id}:`, request.test_list, parseError);
                // Default to an empty array or handle as an error display item
            }
            const testsDisplay = testListParsed.map(t => t.name).join(', ') || 'No tests specified';

            if (!request.fhir_id) {
                // Case: Request was logged locally but might have failed to send to FHIR or fhir_id was not saved.
                dashboardItems.push({
                    type: 'pending_local_error',
                    his_request_id: request.id,
                    patientName: request.patient_name,
                    patientId: request.patient_id,
                    doctorName: request.doctor_name,
                    tests: testsDisplay,
                    requestedAt: request.created_at,
                    statusMessage: 'Pending (FHIR ID missing)',
                    details: 'This request may not have been successfully sent to the lab system.'
                });
                continue;
            }

            try {
                // 1. Always try to find DiagnosticReport(s) first.
                // Sort by date descending (if supported by FHIR server, often default) to get latest first.
                // FHIR standard sort parameter is _sort=-date (for DiagnosticReport, 'date' often refers to effectiveDateTime or issued)
                const drSearchUrl = `${FHIR_SERVER_URL}/DiagnosticReport?based-on=ServiceRequest/${request.fhir_id}&_sort=-date`;
                let diagnosticReportResponse;
                try {
                    diagnosticReportResponse = await axios.get(drSearchUrl, {
                        headers: { 'Accept': 'application/fhir+json' }
                    });
                } catch (drError) {
                    // If searching for DiagnosticReport fails (e.g., 404 if none exist, or other server error),
                    // we'll proceed to check ServiceRequest status. Log the error for diagnostics.
                    console.warn(`[${new Date().toISOString()}] Warning: Could not fetch DiagnosticReport for ServiceRequest/${request.fhir_id}. Error: ${drError.message}. Will check ServiceRequest status.`);
                    diagnosticReportResponse = { data: null }; // Ensure structure for checks below
                }

                let finalReport = null;
                let preliminaryReport = null;
                let otherRelevantReport = null; // For statuses like 'partial', 'registered'

                if (diagnosticReportResponse.data && diagnosticReportResponse.data.entry && diagnosticReportResponse.data.entry.length > 0) {
                    for (const entry of diagnosticReportResponse.data.entry) {
                        const report = entry.resource;
                        if (report.resourceType === 'DiagnosticReport') {
                            if (['final', 'amended', 'corrected'].includes(report.status)) {
                                finalReport = report;
                                break; // Found the most definitive, stop.
                            } else if (['preliminary'].includes(report.status) && !preliminaryReport) {
                                preliminaryReport = report;
                            } else if (['partial', 'registered'].includes(report.status) && !otherRelevantReport) {
                                otherRelevantReport = report;
                            }
                        }
                    }
                }

                const chosenReport = finalReport || preliminaryReport || otherRelevantReport;

                if (chosenReport) {
                    // A report (final, preliminary, or other) was found.
                    dashboardItems.push({
                        type: 'result',
                        his_request_id: request.id,
                        fhir_diagnostic_report_id: chosenReport.id,
                        patientName: chosenReport.subject?.display || request.patient_name,
                        patientId: request.patient_id,
                        statusMessage: `Result: ${chosenReport.status}`, // Frontend uses this to set "Complete" or "Pending"
                        conclusion: chosenReport.conclusion,
                        effectiveDate: chosenReport.effectiveDateTime || chosenReport.issued, // Use issued if effectiveDateTime is not present
                        resultsDisplay: chosenReport.result?.map(r => r.display).join('; ') || 'No detailed results provided.',
                        doctorName: request.doctor_name,
                        testsOrdered: testsDisplay,
                        requestedAt: request.created_at
                    });
                } else {
                    // 2. If NO relevant DiagnosticReport was found, then check ServiceRequest status.
                    const srResponse = await axios.get(`${FHIR_SERVER_URL}/ServiceRequest/${request.fhir_id}`, {
                        headers: { 'Accept': 'application/fhir+json' }
                    });
                    const serviceRequest = srResponse.data;
                    const srFinalStates = ['completed', 'cancelled', 'entered-in-error', 'revoked'];

                    if (srFinalStates.includes(serviceRequest.status)) {
                        // ServiceRequest is final, but no DiagnosticReport found
                        dashboardItems.push({
                            type: 'completed_no_report',
                            his_request_id: request.id,
                            fhir_service_request_id: request.fhir_id,
                            patientName: request.patient_name,
                            patientId: request.patient_id,
                            doctorName: request.doctor_name,
                            tests: testsDisplay,
                            requestedAt: request.created_at,
                            statusMessage: `Request ${serviceRequest.status}`, // e.g., "Request completed"
                            details: `The lab request is ${serviceRequest.status}, but no specific diagnostic report was found.`
                        });
                    } else {
                        // ServiceRequest is not in a final state (e.g., 'active', 'on-hold') and no report found
                        dashboardItems.push({
                            type: 'pending_on_fhir',
                            his_request_id: request.id,
                            fhir_service_request_id: request.fhir_id,
                            patientName: request.patient_name,
                            patientId: request.patient_id,
                            doctorName: request.doctor_name,
                            tests: testsDisplay,
                            requestedAt: request.created_at,
                            statusMessage: `Pending (Lab Status: ${serviceRequest.status})`
                        });
                    }
                }
            } catch (fhirError) {
                console.error(`[${new Date().toISOString()}] FHIR error for HIS request ID ${request.id} (FHIR ID ${request.fhir_id}): ${fhirError.message}`);
                dashboardItems.push({
                    type: 'pending_fhir_comms_error',
                    his_request_id: request.id,
                    patientName: request.patient_name,
                    patientId: request.patient_id,
                    doctorName: request.doctor_name,
                    tests: testsDisplay,
                    requestedAt: request.created_at,
                    statusMessage: 'Pending (FHIR Communication Issue)',
                    details: `Could not retrieve or process status from FHIR server for ServiceRequest/${request.fhir_id}. Error: ${fhirError.message}`
                });
            }
        }
        connection.release(); // Release connection after all operations are done
        console.log(`[${new Date().toISOString()}] app.get('/api/lab-dashboard') - Returning ${dashboardItems.length} items.`);
        res.json({ labDashboardItems: dashboardItems });

    } catch (error) {
        console.error(`[${new Date().toISOString()}] Error fetching lab dashboard items:`, error);
        res.status(500).json({ error: 'Failed to fetch lab dashboard items' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`HIS server running on port ${PORT}`);
});