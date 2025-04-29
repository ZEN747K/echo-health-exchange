
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";

const HomePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100">
      <div className="container mx-auto p-8">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">Health Information Exchange</h1>
          <p className="text-xl text-gray-600">
            Seamless communication between healthcare systems
          </p>
        </header>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="bg-blue-50">
              <CardTitle className="text-blue-700">Hospital Information System</CardTitle>
              <CardDescription>
                Create and manage laboratory test requests
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="mb-4">
                The Hospital Information System allows healthcare providers to:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>Create new laboratory test requests</li>
                <li>Track patient information</li>
                <li>View completed laboratory results</li>
                <li>Manage healthcare provider data</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <Link to="/his">Access HIS</Link>
              </Button>
            </CardFooter>
          </Card>
          
          <Card className="shadow-md hover:shadow-lg transition-shadow">
            <CardHeader className="bg-green-50">
              <CardTitle className="text-green-700">Laboratory Information System</CardTitle>
              <CardDescription>
                Process and report laboratory test results
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <p className="mb-4">
                The Laboratory Information System allows lab technicians to:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-gray-600">
                <li>View pending laboratory requests</li>
                <li>Enter test results and interpretations</li>
                <li>Submit finalized laboratory reports</li>
                <li>Track laboratory workflows</li>
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full">
                <Link to="/lis">Access LIS</Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        <div className="text-center mt-12 max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-4">About Health Information Exchange</h2>
          <p className="text-gray-600 mb-6">
            This system demonstrates interoperability between healthcare systems 
            using the FHIR (Fast Healthcare Interoperability Resources) standard. 
            Data is exchanged seamlessly between hospital and laboratory systems 
            while maintaining standardized healthcare information formats.
          </p>
          <div className="p-4 bg-blue-50 rounded-lg text-sm text-gray-600">
            <strong>Note:</strong> This is a demonstration system. In a production environment,
            additional security, validation, and compliance measures would be implemented.
          </div>
        </div>
      </div>
      
      <footer className="mt-16 py-6 bg-gray-800 text-white text-center">
        <p>© 2025 Health Information Exchange | Educational Demonstration</p>
      </footer>
    </div>
  );
};

export default HomePage;
