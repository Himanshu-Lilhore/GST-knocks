import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Toaster, toast } from 'react-hot-toast';
import { PhoneIcon, CheckCircleIcon, TrashIcon, ChevronDownIcon, ClockIcon, MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/solid';
import Archieves from './Archives';
import { useNavigate } from 'react-router-dom';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function Home() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'done'
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef(null);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [highlightedContactId, setHighlightedContactId] = useState(null);
  const contactRefs = useRef({});
  const [showAddContact, setShowAddContact] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newGstin, setNewGstin] = useState('');
  const navigate = useNavigate()


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
    formData.append('file', file);
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

  const handleDelete = async (contactId) => {
    try {
      const res = await axios.delete(`${BACKEND_URL}/api/contacts/${contactId}`);
      toast.success(res.data.message);
      fetchContacts();
    } catch (error) {
      toast.error('Failed to delete contact');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const toggleCard = (contactId) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(contactId)) {
        newSet.delete(contactId);
      } else {
        newSet.add(contactId);
      }
      return newSet;
    });
  };

  const handleAddContact = async (e) => {
    e.preventDefault();

    // Validate required fields
    if (!newName.trim() || !newPhone.trim()) {
      toast.error('Name and phone number are required');
      return;
    }

    try {
      const response = await axios.post(`${BACKEND_URL}/api/contacts`, {
        name: newName.trim(),
        phoneNumber: newPhone.trim(),
        gstin: newGstin.trim()
      });

      if (response.data.success) {
        toast.success('Contact added successfully');
        // Refresh contacts
        fetchContacts();
        // Reset form fields
        setNewName('');
        setNewPhone('');
        setNewGstin('');
        setShowAddContact(false);
      }
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to add contact';
      toast.error(message);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (contact) => {
    setFilter('all'); // Switch to the "all" tab
    setSearchQuery(contact.name);
    setShowSuggestions(false);
    setSelectedContactId(contact._id);
    setHighlightedContactId(contact._id); // Highlight the selected contact
  };

  const getContactStatus = (contact) => {
    if (!contact.called) return 'Pending';
    return 'Done';
  };

  const filteredContacts = contacts.filter(contact => {
    const matchesFilter = filter === 'all' ? true :
      filter === 'pending' ? !contact.called :
        filter === 'done' ? contact.called : true;

    const matchesSearch = searchQuery === '' ? true :
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phoneNumber.includes(searchQuery);

    return matchesFilter && matchesSearch;
  });

  const suggestions = contacts.filter(contact =>
    searchQuery !== '' && (
      contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      contact.phoneNumber.includes(searchQuery)
    )
  ).slice(0, 5); // Limit to 5 suggestions

  // Add counts for each category
  const counts = {
    all: contacts.length,
    pending: contacts.filter(c => !c.called).length,
    done: contacts.filter(c => c.called).length
  };

  const handleStatusChange = async (contact, newStatus) => {
    try {
      await axios.put(`${BACKEND_URL}/api/contacts/${contact._id}`, { status: newStatus });
      fetchContacts();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Add scroll effect when selectedContactId changes
  useEffect(() => {
    if (selectedContactId && contactRefs.current[selectedContactId]) {
      contactRefs.current[selectedContactId].scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
      setHighlightedContactId(selectedContactId);
      setSelectedContactId(null); // Reset after scrolling

      // Remove highlight after 2 seconds
      const timer = setTimeout(() => {
        setHighlightedContactId(null);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [selectedContactId]);

  return (
    <div className="min-h-screen">
      <Toaster position="top-right" />

      <div className="max-w-4xl mx-auto">
        {/* Combined File Upload and Add Contact Button Container */}
        <div className="bg-white rounded-lg shadow p-6 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <input
            type="file"
            accept=".pdf,.xlsx,.xls"
            onChange={handleFileUpload}
            className="w-full md:w-auto text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
          <button
            onClick={() => setShowAddContact(!showAddContact)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded w-full md:w-auto"
          >
            {showAddContact ? 'Cancel' : 'Add Contact Manually'}
          </button>
        </div>

        {/* Manual input Form */}
        <div
          className={`overflow-hidden transition-all duration-400 ease-in-out ${showAddContact ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}
        >
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <form onSubmit={handleAddContact}>
              {/* Form fields */}
              <div className="mb-4">
                <label className="block text-gray-700 mb-2" htmlFor="name">
                  Name<span className="text-red-500">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2" htmlFor="phone">
                  Phone Number<span className="text-red-500">*</span>
                </label>
                <input
                  id="phone"
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 mb-2" htmlFor="gstin">
                  GST Number (Optional)
                </label>
                <input
                  id="gstin"
                  type="text"
                  value={newGstin}
                  onChange={(e) => setNewGstin(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="bg-green-500 hover:bg-green-600 text-white font-medium py-2 px-4 rounded"
                >
                  Save Contact
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Search bar */}
        <div className="relative mb-6" ref={searchRef}>
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or number..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowSuggestions(true);
              }}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {/* Clear button */}
            {searchQuery && (
              <XMarkIcon
                className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 cursor-pointer"
                onClick={handleClearSearch}
              />
            )}
          </div>

          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-y-auto">
              {suggestions.map((contact, index) => (
                <div
                  key={contact._id}
                  className={`px-4 py-2 hover:bg-gray-50 cursor-pointer ${index !== suggestions.length - 1 ? 'border-b border-gray-100' : ''
                    }`}
                  onClick={() => handleSuggestionClick(contact)}
                >
                  <div className="font-medium">{contact.name}</div>
                  <div className="text-sm text-gray-500">{contact.phoneNumber}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bean-shaped sorter */}
        <div className="sticky top-0 z-10 bg-white rounded-full shadow-md p-1 mb-6 w-full">
          <div className="flex bg-gray-100 rounded-full p-1 w-full">
            <button
              onClick={() => setFilter('all')}
              className={`flex-1 px-6 py-2 rounded-full text-sm font-medium transition-all relative border-2 ${filter === 'all'
                ? 'bg-white text-blue-600 shadow-md border-blue-200'
                : 'text-gray-600 hover:text-gray-900 border-transparent'
                }`}
            >
              All
              <span className="absolute -top-1 -right-1 bg-blue-100 text-blue-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                {counts.all}
              </span>
            </button>
            <button
              onClick={() => setFilter('pending')}
              className={`flex-1 px-6 py-2 rounded-full text-sm font-medium transition-all relative border-2 ${filter === 'pending'
                ? 'bg-white text-yellow-600 shadow-md border-yellow-200'
                : 'text-gray-600 hover:text-gray-900 border-transparent'
                }`}
            >
              Pending
              <span className="absolute -top-1 -right-1 bg-yellow-100 text-yellow-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                {counts.pending}
              </span>
            </button>
            <button
              onClick={() => setFilter('done')}
              className={`flex-1 px-6 py-2 rounded-full text-sm font-medium transition-all relative border-2 ${filter === 'done'
                ? 'bg-white text-green-600 shadow-md border-green-200'
                : 'text-gray-600 hover:text-gray-900 border-transparent'
                }`}
            >
              Done
              <span className="absolute -top-1 -right-1 bg-green-100 text-green-600 text-xs font-semibold px-2 py-0.5 rounded-full">
                {counts.done}
              </span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center">Processing PDF...</div>
        ) : (
          <div className="grid gap-4">
            {filteredContacts.map((contact, index) => (
              <div
                key={contact._id}
                ref={el => contactRefs.current[contact._id] = el}
                className={`bg-white rounded-lg shadow p-4 cursor-pointer hover:bg-gray-50 transition-all duration-300 select-none ${highlightedContactId === contact._id
                  ? 'ring-2 ring-blue-500 bg-blue-50'
                  : ''
                  }`}
                onClick={() => toggleCard(contact._id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {contact.called ? (
                      <CheckCircleIcon className="flex-shrink-0 h-5 w-5 text-green-500" />
                    ) : (
                      <ClockIcon className="flex-shrink-0 h-5 w-5 text-yellow-500" />
                    )}
                    <div className="select-text">
                      <span className="font-medium block text-lg">{contact.name}</span>
                      <span className="text-sm text-gray-500">
                        {contact.phoneNumber}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCall(contact);
                      }}
                      className={`flex items-center px-4 py-2 rounded-lg select-none ${contact.called
                        ? 'bg-gray-100 hover:bg-gray-200 text-gray-600'
                        : 'bg-yellow-400/80 text-black hover:bg-yellow-500'
                        }`}
                    >
                      <PhoneIcon className="h-5 w-5 mr-2" />
                      Call
                    </button>

                    <ChevronDownIcon
                      className={`h-5 w-5 text-gray-500 transition-transform duration-200 select-none ${expandedCards.has(contact._id) ? 'rotate-180' : ''
                        }`}
                    />
                  </div>
                </div>

                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${expandedCards.has(contact._id) ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                >
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <div className="flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(contact._id);
                          }}
                          className="flex items-center px-3 py-2 rounded-lg border-2 border-red-500/60 text-red-600 hover:bg-red-500 hover:text-white transition-colors select-none"
                        >
                          <TrashIcon className="h-5 w-5 mr-2" />
                          Delete
                        </button>

                        {!contact.called ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(contact, 'done');
                            }}
                            className="flex items-center px-3 py-2 rounded-lg border-2 border-green-500/60 text-green-600 hover:bg-green-500 hover:text-white transition-colors select-none"
                          >
                            <CheckCircleIcon className="h-5 w-5 mr-2" />
                            Mark as Done
                          </button>
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStatusChange(contact, 'pending');
                            }}
                            className="flex items-center px-3 py-2 rounded-lg border-2 border-yellow-500/60 text-yellow-600 hover:bg-yellow-500 hover:text-white transition-colors select-none"
                          >
                            Mark as Pending
                          </button>
                        )}
                      </div>

                      {contact.gstin && (
                        <div className="flex gap-2 text-sm text-gray-500 select-none mt-2">
                          <div className='text-black font-bold'>GSTIN</div>
                          <div>{contact.gstin}</div>
                        </div>
                      )}

                      {contact.history && contact.history.length > 0 && (
                        <div className="text-sm text-gray-500 select-none mt-2">
                          <div className='text-black font-bold'>Contact history ({contact.history.length})</div>
                          <div className='max-h-24 overflow-auto'>
                            {contact.history.map((record, index) => {
                              return <div key={index} className='px-4'>{formatDate(record)}</div>
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 