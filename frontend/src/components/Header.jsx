import { useNavigate } from 'react-router-dom';
import { Bars3Icon } from '@heroicons/react/24/solid';

export default function Header({ onHamburgerClick }) {
    const navigate = useNavigate();

    return (
        <div className="flex flex-row justify-between items-center p-4 bg-gray-100">
            <button
                className="text-4xl font-extrabold cursor-pointer"
                onClick={() => navigate('/GST-knocks/home')}
            >
                GST knocks
            </button>
            <button className="w-fit cursor-pointer" onClick={onHamburgerClick}>
                <Bars3Icon className="h-8 w-8" />
            </button>
        </div>
    );
}
