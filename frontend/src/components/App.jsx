import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import Drawer from './Drawer';

export default function App() {
    const [drawerOpen, setDrawerOpen] = useState(false);

    const toggleDrawer = () => setDrawerOpen(!drawerOpen);
    const closeDrawer = () => setDrawerOpen(false);

    return (
        <div>
            <div className={`${drawerOpen && 'grayscale-75 blur-sm transition-all duration-300'}`}><Header onHamburgerClick={toggleDrawer} /></div>
            <div className='shadow-2xl shadow-black'><Drawer isOpen={drawerOpen} onClose={closeDrawer} /></div>
            <div className={`p-4 ${drawerOpen && 'grayscale-75 blur-sm transition-all duration-300'}`}><Outlet /></div>
        </div>
    );
}
