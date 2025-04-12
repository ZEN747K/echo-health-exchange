
CREATE TABLE IF NOT EXISTS lab_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    patient_name VARCHAR(255) NOT NULL,
    patient_id VARCHAR(100),
    doctor_name VARCHAR(255) NOT NULL,
    test_list JSON NOT NULL,
    status VARCHAR(50) NOT NULL,
    fhir_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS lab_results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    request_id INT,
    fhir_id VARCHAR(100),
    result_data JSON NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (request_id) REFERENCES lab_requests(id)
);

INSERT INTO lab_requests (patient_name, patient_id, doctor_name, test_list, status)
VALUES 
('John Smith', 'PT10001', 'Dr. Maria Chen', '[{"code":"CBC", "name":"Complete Blood Count"}, {"code":"GLUCOSE", "name":"Blood Glucose"}]', 'PENDING'),
('Sarah Johnson', 'PT10002', 'Dr. James Wilson', '[{"code":"LIPID", "name":"Lipid Panel"}, {"code":"LIVER", "name":"Liver Function Test"}]', 'PENDING');
