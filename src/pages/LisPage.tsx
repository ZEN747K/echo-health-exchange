
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";

interface LabRequest {
  id: string;
  patientName: string;
  patientId: string;
  doctorName: string;
  status: string;
  tests: {
    code: string;
    name: string;
  }[];
  extensions?: {
    url: string;
    valueInteger?: number;
    valueString?: string;
    valueDecimal?: number;
  }[];
}

interface TestResult {
  code: string;
  name: string;
  value: string;
  unit: string;
  interpretation: string;
  note: string;
}

const LisPage = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<LabRequest[]>([]);
  const [showResultForm, setShowResultForm] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LabRequest | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [conclusion, setConclusion] = useState("");

  const { data: labRequests, isLoading, refetch } = useQuery({
    queryKey: ["labRequests"],
    queryFn: async () => {
      const response = await fetch("http://localhost:8082/api/lab-requests");
      if (!response.ok) {
        throw new Error("Failed to fetch lab requests");
      }
      const data = await response.json();
      return data.labRequests || [];
    }
  });

  useEffect(() => {
    if (labRequests) {
      setRequests(labRequests);
    }
  }, [labRequests]);

  const handleEnterResults = (request: LabRequest) => {
    setSelectedRequest(request);
    
    // Initialize test results
    const initialTestResults = request.tests.map(test => ({
      code: test.code,
      name: test.name,
      value: "",
      unit: "",
      interpretation: "",
      note: ""
    }));
    
    setTestResults(initialTestResults);
    setConclusion("");
    setShowResultForm(true);
  };

  const handleUpdateTestResult = (index: number, field: keyof TestResult, value: string) => {
    const updatedResults = [...testResults];
    updatedResults[index] = { ...updatedResults[index], [field]: value };
    setTestResults(updatedResults);
  };

  const handleSubmitResults = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedRequest) return;
    
    try {
      toast({
        title: "Submitting",
        description: "Submitting results...",
      });
      
      const response = await fetch("http://localhost:8082/api/lab-results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          requestId: selectedRequest.id,
          patientName: selectedRequest.patientName,
          testResults,
          conclusion,
          status: "final"
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error: ${errorText}`);
      }
      
      const data = await response.json();
      
      toast({
        title: "Success",
        description: "Lab results submitted successfully!",
        variant: "default"
      });
      
      // Reset and close form
      setShowResultForm(false);
      setSelectedRequest(null);
      setTestResults([]);
      setConclusion("");
      
      // Refresh requests
      refetch();
      
    } catch (error) {
      console.error("Error submitting lab results:", error);
      toast({
        title: "Error",
        description: `Error submitting lab results: ${(error as Error).message}`,
        variant: "destructive"
      });
    }
  };

  // Extract patient details from extensions
  const getPatientDetails = (request: LabRequest) => {
    let details = [];
    
    if (request.extensions) {
      const ageExt = request.extensions.find(ext => ext.url === "http://his.org/fhir/extension/patient-age");
      const genderExt = request.extensions.find(ext => ext.url === "http://his.org/fhir/extension/patient-gender");
      const weightExt = request.extensions.find(ext => ext.url === "http://his.org/fhir/extension/patient-weight");
      
      if (ageExt?.valueInteger) details.push(`Age: ${ageExt.valueInteger}`);
      if (genderExt?.valueString) details.push(`Gender: ${genderExt.valueString}`);
      if (weightExt?.valueDecimal) details.push(`Weight: ${weightExt.valueDecimal} kg`);
    }
    
    return details.join(" | ");
  };

  return (
    <div className="container mx-auto p-4">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Laboratory Information System</h1>
        <p className="text-gray-600">Process and report laboratory test results</p>
      </header>

      <div className="mb-6 flex justify-between items-center">
        <h2 className="text-xl font-bold">Pending Laboratory Requests</h2>
        <Button onClick={() => refetch()}>Refresh Requests</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-3">Patient</th>
              <th className="p-3">Doctor</th>
              <th className="p-3">Tests</th>
              <th className="p-3">Status</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="p-4 text-center">Loading laboratory requests...</td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-4 text-center">No pending laboratory requests found.</td>
              </tr>
            ) : (
              requests.map(request => (
                <tr key={request.id} className="border-b hover:bg-gray-50">
                  <td className="p-3">
                    <div className="font-medium">{request.patientName}</div>
                    <div className="text-sm text-gray-600">ID: {request.patientId}</div>
                    {getPatientDetails(request) && (
                      <div className="text-xs text-gray-500">
                        {getPatientDetails(request)}
                      </div>
                    )}
                  </td>
                  <td className="p-3">{request.doctorName}</td>
                  <td className="p-3">
                    <ul className="list-disc list-inside">
                      {request.tests.map((test, i) => (
                        <li key={i} className="text-sm">{test.name}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs ${
                      request.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-100"
                    }`}>
                      {request.status}
                    </span>
                  </td>
                  <td className="p-3">
                    {request.status === "active" ? (
                      <Button 
                        onClick={() => handleEnterResults(request)}
                        size="sm"
                      >
                        Enter Results
                      </Button>
                    ) : (
                      <Button disabled size="sm" variant="outline">
                        Completed
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showResultForm && selectedRequest && (
        <Card className="mt-8 p-6">
          <h3 className="text-lg font-bold mb-4">Enter Test Results</h3>
          <form onSubmit={handleSubmitResults}>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Patient Name:
              </label>
              <Input value={selectedRequest.patientName} readOnly />
              {getPatientDetails(selectedRequest) && (
                <div className="mt-1 text-sm text-gray-500">
                  {getPatientDetails(selectedRequest)}
                </div>
              )}
            </div>

            {testResults.map((test, index) => (
              <div key={index} className="mb-6 p-4 border rounded-md bg-gray-50">
                <h4 className="font-medium mb-2">{test.name}</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Result Value:
                    </label>
                    <Input
                      value={test.value}
                      onChange={(e) => handleUpdateTestResult(index, "value", e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Unit:
                    </label>
                    <Input
                      value={test.unit}
                      onChange={(e) => handleUpdateTestResult(index, "unit", e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Interpretation:
                    </label>
                    <select
                      value={test.interpretation}
                      onChange={(e) => handleUpdateTestResult(index, "interpretation", e.target.value)}
                      required
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
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

                <div className="mt-2">
                  <label className="block text-sm font-medium mb-1">
                    Notes:
                  </label>
                  <Textarea
                    value={test.note}
                    onChange={(e) => handleUpdateTestResult(index, "note", e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            ))}

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">
                Conclusion / Interpretation:
              </label>
              <Textarea
                value={conclusion}
                onChange={(e) => setConclusion(e.target.value)}
                rows={3}
                required
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowResultForm(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Submit Final Results</Button>
            </div>
          </form>
        </Card>
      )}

      <footer className="mt-8 text-center text-sm text-gray-600">
        <p>© 2025 Laboratory Information System | <Link to="/" className="text-blue-600 hover:underline">Back to Home</Link></p>
      </footer>
    </div>
  );
};

export default LisPage;
