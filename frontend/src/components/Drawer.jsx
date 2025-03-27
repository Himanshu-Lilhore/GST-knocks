import { Link } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/solid';
import { toast } from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import axios from 'axios'
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;


export default function Drawer({ isOpen, onClose }) {
    const navigate = useNavigate()
    const navStyles = 'py-1 px-2 cursor-pointer hover:bg-gray-200 rounded-md underline underline-offset-4 transition-all duration-300'
    
    const handleArchiveContacts = async () => {
        try {
            const res = await axios.post(`${BACKEND_URL}/api/archive`);
            toast.success(res.data.message);
            if(res.status === 200) {navigate('/GST-knocks/home'); window.location.reload();}
        } catch (error) {
            toast.error('Failed to archive contacts');
        }
    };

    return (
        <div
            className={`fixed top-0 right-0 h-full w-64 bg-white shadow-lg transform transition-transform duration-300 z-50 ${isOpen ? 'translate-x-0' : 'translate-x-full'
                }`}
        >
            <div className="p-4">
                <button className="mb-6 cursor-pointer" onClick={onClose}>
                    <XMarkIcon className="size-8 p-1 rounded-full hover:bg-gray-200" />
                </button>
                <nav className="flex flex-col space-y-4 text-lg">
                    {/* Archive Button */}
                    <div className="mb-4">
                        <button
                            onClick={handleArchiveContacts}
                            className="bg-red-500/90 hover:bg-red-600 text-white text-base py-2 px-4 rounded"
                        >
                            Archive current Contacts
                        </button>
                    </div>

                    <Link to="/GST-knocks/home" onClick={onClose} className={navStyles}>
                        Home
                    </Link>

                    <Link to="/GST-knocks/archive" onClick={onClose} className={navStyles}>
                        Previous Archives
                    </Link>
                </nav>
            </div>
        </div>
    );
}
