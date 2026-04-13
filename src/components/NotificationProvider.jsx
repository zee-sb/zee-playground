import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, Info } from 'lucide-react';

const NotificationContext = createContext(null);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within a NotificationProvider');
  return context;
};

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);

  const add = useCallback((type, title, message) => {
    const id = Date.now();
    setNotifications((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    }, 4000);
  }, []);

  const success = (title, msg) => add('success', title, msg);
  const error = (title, msg) => add('error', title, msg);
  const info = (title, msg) => add('info', title, msg);

  return (
    <NotificationContext.Provider value={{ success, error, info }}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
        {notifications.map((n) => (
          <div 
            key={n.id} 
            className={`w-[320px] p-4 rounded-xl border shadow-2xl bg-white flex items-start gap-3 animate-in slide-in-from-right-full duration-300 pointer-events-auto`}
          >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[18px] shrink-0 ${
              n.type === 'success' ? 'bg-[#DCFCE7] text-[#166534]' : 
              n.type === 'error' ? 'bg-[#FEE2E2] text-[#991B1B]' : 
              'bg-[#F3F4F6] text-[#374151]'
            }`}>
              {n.type === 'success' ? <CheckCircle size={18} className="text-green-500" /> : n.type === 'error' ? <XCircle size={18} className="text-red-500" /> : <Info size={18} className="text-blue-500" />}
            </div>
            <div className="flex-1 min-w-0">
               <div className="text-[14px] font-bold text-[#111827]">{n.title}</div>
               <div className="text-[12.5px] text-[#6B7280] leading-normal mt-0.5">{n.message}</div>
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};
