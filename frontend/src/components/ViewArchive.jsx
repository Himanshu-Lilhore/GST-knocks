import React, { useEffect, useState, useRef } from 'react';
import { PhoneIcon, ChevronDownIcon } from '@heroicons/react/24/solid';
import axios from 'axios'
import { useParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function ViewArchive() {
    const [archive, setArchive] = useState({ contacts: [] })
    const contactRefs = useRef({});
    const [expandedCards, setExpandedCards] = useState(new Set());
    const { id } = useParams()

    useEffect(() => {
        async function fetchContacts() {
            try {
                const response = await axios.get(`${BACKEND_URL}/api/archive/${id}`);
                // console.log(response.data)
                setArchive(response.data);
            } catch (error) {
                toast.error('Failed to fetch archived contacts');
            }
        }
        fetchContacts();
    }, [])

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

    const handleCall = async (contact) => {
        try {
            await axios.put(`${BACKEND_URL}/api/contacts/${contact._id}`);
            window.location.href = `tel:${contact.phoneNumber}`;
            fetchContacts();
        } catch (error) {
            toast.error('Failed to update call status');
        }
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

    return (
        <div className="grid gap-4">
            <div className='my-3 text-lg text-gray-600 flex gap-2 font-semibold'>
                <div>Archived on</div>
                <div className='rounded-lg border border-gray-400 px-2 bg-gray-100 text-black'>{formatDate(archive.createdAt)}</div>
            </div>

            {archive.contacts.map((contact, index) => (
                <div
                    key={contact._id}
                    ref={el => contactRefs.current[contact._id] = el}
                    className='bg-white rounded-lg shadow p-4 cursor-pointer hover:bg-gray-50 transition-all duration-300 select-none'
                    onClick={() => toggleCard(contact._id)}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className='rounded-full flex-shrink-0 size-5 bg-gray-500'></div>
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
                                className='flex items-center px-4 py-2 rounded-lg select-none bg-green-100 hover:bg-green-200 text-gray-600'
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
                                {contact.gstin && (
                                    <div className="flex gap-2 text-sm text-gray-500 select-none mt-2">
                                        <div className='text-black font-bold'>GSTIN</div>
                                        <div>{contact.gstin}</div>
                                    </div>
                                )}
                                {contact.history.length > 0 && (
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
    )
}
