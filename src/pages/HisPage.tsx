
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";

interface LabResult {
  id: string;
  patientName: string;
  status: string;
  conclusion?: string;
  effectiveDate?: string;
  results: string[];
}

const HisPage = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("create");
  const [formData, setFormData] = useState({
    patientName: "",
    patientId: "",
    patientAge: "",
    patientGender: "",
    patientWeight: "",
    doctorName: "",
    tests: [] as string[]
  });
  const [searchTerm, setSearchTerm] = useState("");

  // Query for lab results
  const {
    data: labResults,
    isLoading,
    refetch: refreshResults
  } = useQuery({
    queryKey: ["labResults"],
    queryFn: async () => {
      const response = await fetch("http://localhost:8081/api/lab-results");
      if (!response.ok) {
        throw new Error("Failed to fetch lab results");
      }
      const data = await response.json();
      return data.labResults || [];
    },
    enabled: activeTab === "results"
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (testCode: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({ ...prev, tests: [...prev.tests, testCode] }));
    } else {
      setFormData(prev => ({
        ...prev,
        tests: prev.tests.filter(test => test !== testCode)
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate inputs
    if (!formData.patientName || !formData.doctorName || formData.tests.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please complete required fields and select at least one test",
        variant: "destructive"
      });
      return;
    }

    // Format test data
    const selectedTests = formData.tests.map(testCode => {
      const testName = testLabels[testCode] || testCode;
      return {
        code: testCode,
        name: testName
      };
    });

    try {
      const response = await fetch("http://localhost:8081/api/lab-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          patientName: formData.patientName,
          patientId: formData.patientId,
          patientAge: formData.patientAge,
          patientGender: formData.patientGender,
          patientWeight: formData.patientWeight,
          doctorName: formData.doctorName,
          testList: selectedTests
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to create lab request");
      }

      // Show success message
      toast({
        title: "Success",
        description: "Laboratory request sent successfully!",
        variant: "default"
      });
      
      // Reset form
      setFormData({
        patientName: "",
        patientId: "",
        patientAge: "",
        patientGender: "",
        patientWeight: "",
        doctorName: "",
        tests: []
      });

    } catch (error) {
      console.error("Error submitting lab request:", error);
      toast({
        title: "Error",
        description: "Error sending laboratory request. Please try again.",
        variant: "destructive"
      });
    }
  };

  // Filter results based on search term
  const filteredResults = labResults?.filter((result: LabResult) => 
    result.patientName.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Test labels mapping
  const testLabels: Record<string, string> = {
    "CBC": "Complete Blood Count (CBC)",
    "GLUCOSE": "Blood Glucose",
    "LIPID": "Lipid Panel",
    "LIVER": "Liver Function Test",
    "KIDNEY": "Kidney Function Test",
    "THYROID": "Thyroid Function Test",
    "HBA1C": "HbA1c",
    "URINALYSIS": "Urinalysis"
  };
  
  const availableTests = [
    { value: "CBC", label: "Complete Blood Count (CBC)" },
    { value: "GLUCOSE", label: "Blood Glucose" },
    { value: "LIPID", label: "Lipid Panel" },
    { value: "LIVER", label: "Liver Function Test" },
    { value: "KIDNEY", label: "Kidney Function Test" },
    { value: "THYROID", label: "Thyroid Function Test" },
    { value: "HBA1C", label: "HbA1c" },
    { value: "URINALYSIS", label: "Urinalysis" }
  ];

  return (
    <div className="container mx-auto p-4">
      <header className="mb-8 text-center">
        <h1 className="text-3xl font-bold">Hospital Information System</h1>
        <p className="text-gray-600">Create and manage laboratory test requests</p>
      </header>

      <Tabs 
        defaultValue="create" 
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value);
          if (value === "results") {
            refreshResults();
          }
        }}
        className="mb-6"
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="create">Create Lab Request</TabsTrigger>
          <TabsTrigger value="results">View Lab Results</TabsTrigger>
        </TabsList>
        
        <TabsContent value="create" className="p-4">
          <h2 className="text-xl font-bold mb-4">New Laboratory Test Request</h2>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label htmlFor="patientName" className="block text-sm font-medium">
                  Patient Name:
                </label>
                <Input
                  id="patientName"
                  name="patientName"
                  value={formData.patientName}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div>
                <label htmlFor="patientId" className="block text-sm font-medium">
                  Patient ID (optional):
                </label>
                <Input
                  id="patientId"
                  name="patientId"
                  value={formData.patientId}
                  onChange={handleInputChange}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="patientAge" className="block text-sm font-medium">
                    Age:
                  </label>
                  <Input
                    id="patientAge"
                    name="patientAge"
                    type="number"
                    min="0"
                    max="120"
                    value={formData.patientAge}
                    onChange={handleInputChange}
                  />
                </div>
                
                <div>
                  <label htmlFor="patientGender" className="block text-sm font-medium">
                    Gender:
                  </label>
                  <select
                    id="patientGender"
                    name="patientGender"
                    value={formData.patientGender}
                    onChange={handleInputChange}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select...</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="patientWeight" className="block text-sm font-medium">
                    Weight (kg):
                  </label>
                  <Input
                    id="patientWeight"
                    name="patientWeight"
                    type="number"
                    min="0"
                    max="500"
                    step="0.1"
                    value={formData.patientWeight}
                    onChange={handleInputChange}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="doctorName" className="block text-sm font-medium">
                  Doctor Name:
                </label>
                <Input
                  id="doctorName"
                  name="doctorName"
                  value={formData.doctorName}
                  onChange={handleInputChange}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Laboratory Tests:
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  {availableTests.map((test) => (
                    <div key={test.value} className="flex items-center space-x-2">
                      <Checkbox
                        id={test.value}
                        checked={formData.tests.includes(test.value)}
                        onCheckedChange={(checked) => handleCheckboxChange(test.value, checked === true)}
                      />
                      <label
                        htmlFor={test.value}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {test.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit">Send Laboratory Request</Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="results" className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Laboratory Test Results</h2>
            <div className="flex space-x-2">
              <Input
                placeholder="Search by patient name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
              <Button variant="outline" onClick={() => refreshResults()}>
                Refresh Results
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            {isLoading ? (
              <div className="text-center p-8">Loading lab results...</div>
            ) : filteredResults.length === 0 ? (
              <div className="text-center p-8 text-gray-500">No lab results found.</div>
            ) : (
              filteredResults.map((result: LabResult) => (
                <Card key={result.id} className="p-4">
                  <h3 className="text-lg font-medium mb-2">Results for {result.patientName}</h3>
                  <div className="flex justify-between text-sm text-gray-500 mb-2">
                    <div>Date: {result.effectiveDate ? new Date(result.effectiveDate).toLocaleDateString() : 'Unknown'}</div>
                    <div className={`px-2 py-1 rounded text-xs ${result.status === 'final' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {result.status}
                    </div>
                  </div>
                  <div className="mt-3 space-y-2">
                    {result.conclusion && <p className="text-sm font-medium">Conclusion: {result.conclusion}</p>}
                    
                    {result.results && result.results.length > 0 && (
                      <div className="mt-2">
                        <strong className="text-sm">Tests Results:</strong>
                        <ul className="list-disc list-inside mt-1 text-sm">
                          {result.results.map((test, idx) => (
                            <li key={idx}>{test}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <footer className="mt-8 text-center text-sm text-gray-600">
        <p>© 2025 Hospital Information System | <a href="http://localhost:8080" className="text-blue-600 hover:underline">Back to Home</a></p>
      </footer>
    </div>
  );
};

export default HisPage;
