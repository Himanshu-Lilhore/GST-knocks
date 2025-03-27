import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';


const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

export default function Archives() {
    const [archives, setArchives] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchArchives();
    }, []);

    const fetchArchives = async () => {
        try {
            const response = await axios.get(`${BACKEND_URL}/api/archives`);
            setArchives(response.data);
        } catch (error) {
            toast.error('Failed to fetch archived contacts');
        }
    };

    const handleClick = (id) => {
        navigate(`/GST-knocks/archive/${id}`)
    }

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">Archives</h2>
            <div className="flex flex-col gap-4 bg-white rounded-lg shadow p-6 mb-6">
                {archives.length === 0 ? (
                    <p>No archives available.</p>
                ) : (
                    archives.map(archive => (
                        <button onClick = {() => handleClick(archive._id)} key={archive._id} className="bg-gray-200 hover:bg-gray-300 py-3 cursor-pointer rounded-md">
                            <span className="font-medium">{new Date(archive.createdAt).toLocaleString('en-GB', {
                                day: '2-digit',
                                month: 'long',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                hour12: true
                            })}
                            </span>
                        </button>
                    ))
                )}
            </div>
        </div>
    );
};