import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
     <nav className="flex items-center justify-between px-6 py-4 bg-white shadow-sm">

     <Link to="/" className="text-lg font-bold text-slate-800">
      
      
         🎟️ SeatBooker
       </Link>
 
         <div className="flex items-center gap-4 text-sm">
            {user ? (
           <>
        
      <span className="text-slate-600">Hi, {user.name}</span>

             <button

              onClick={() => {
                logout();

               navigate("/login");
              }}
           className="px-3 py-1.5 rounded bg-slate-100 hover:bg-slate-200"
            >
             Logout
            
             </button>
         </>
        
       ) : (
         
         <>
         <Link to="/login" className="px-3 py-1.5 rounded hover:bg-slate-100">
               Login
             </Link>
             <Link
             to="/register"
             className="px-3 py-1.5 rounded bg-slate-900 text-white hover:bg-slate-700"
         >
               Sign up
         </Link>
          </>

         )}
     </div>


     </nav>
  );
}
