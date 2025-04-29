
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Index = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redirect to our React homepage instead of the static redirector
    navigate('/');
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Health Information Exchange</h1>
        <p className="text-xl text-gray-600 mb-4">Redirecting to application...</p>
        <div className="animate-pulse text-blue-500">Please wait</div>
      </div>
    </div>
  );
};

export default Index;
