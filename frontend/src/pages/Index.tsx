import FloatChatDashboard from '@/components/FloatChatDashboard';

const Index = () => {
  console.log('Index component rendering...');

  // Test if basic components work first
  const testMode = false;

  if (testMode) {
    return (
      <div className="p-8 min-h-screen bg-blue-50">
        <h1 className="text-4xl font-bold text-blue-600 mb-4">FloatChat Dashboard</h1>
        <p className="text-lg mb-8">Testing basic rendering...</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-lg border border-blue-200">
            <h2 className="text-xl font-semibold mb-4">System Status</h2>
            <p className="text-green-600">✅ React is working</p>
            <p className="text-green-600">✅ Tailwind CSS is working</p>
            <p className="text-blue-600">🔄 Testing components...</p>
          </div>
        </div>
      </div>
    );
  }

  try {
    return <FloatChatDashboard />;
  } catch (error) {
    console.error('Error rendering FloatChatDashboard:', error);
    return (
      <div className="p-8 min-h-screen bg-red-50">
        <h1 className="text-4xl font-bold text-red-600 mb-4">Dashboard Error</h1>
        <p className="text-lg mb-4">There was an error loading the dashboard.</p>
        <div className="bg-white p-4 rounded border border-red-200">
          <p className="text-sm text-gray-600">Error: {String(error)}</p>
        </div>
      </div>
    );
  }
};

export default Index;
