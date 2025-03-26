import { useState, useEffect } from 'react';
import axios from 'axios';
import { Toaster, toast } from 'react-hot-toast';
import { PhoneIcon, CheckCircleIcon } from '@heroicons/react/24/solid';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

function App() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const response = await axios.get(`${BACKEND_URL}/api/contacts`);
      setContacts(response.data);
    } catch (error) {
      toast.error('Failed to fetch contacts');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('pdf', file);
    setLoading(true);

    try {
      await axios.post(`${BACKEND_URL}/api/upload`, formData);
      toast.success('PDF processed successfully');
      fetchContacts();
    } catch (error) {
      toast.error('Failed to process PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleCall = async (contact) => {
    try {
      await axios.put(`${BACKEND_URL}/api/contacts/${contact._id}`);
      window.location.href = `tel:${contact.phoneNumber}`;
      fetchContacts();
    } catch (error) {
      toast.error('Failed to update call status');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <Toaster position="top-right" />
      
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">GST knocks</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
        </div>

        {loading ? (
          <div className="text-center">Processing PDF...</div>
        ) : (
          <div className="grid gap-4">
            {contacts.map((contact) => (
              <div
                key={contact._id}
                className="bg-white rounded-lg shadow p-4 flex items-center justify-between"
              >
                <div className="flex items-center">
                  {contact.called && (
                    <CheckCircleIcon className="h-5 w-5 text-green-500 mr-2" />
                  )}
                  <span className="font-medium">{contact.phoneNumber}</span>
                </div>
                
                <button
                  onClick={() => handleCall(contact)}
                  className={`flex items-center px-4 py-2 rounded-lg ${
                    contact.called
                      ? 'bg-gray-100 text-gray-600'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  <PhoneIcon className="h-5 w-5 mr-2" />
                  Call
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App; 