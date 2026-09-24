import type { Seat as SeatType } from "../types";

 interface Props {
   seat: SeatType;
   onClick: (seat: SeatType) => void;
 }

   const STATUS_STYLES: Record<string, string> = {
       available: "bg-seatAvailable/20 border-seatAvailable text-green-800 hover:bg-seatAvailable/40 cursor-pointer",
       locked: "bg-seatLocked/20 border-seatLocked text-amber-800 cursor-not-allowed",
       booked: "bg-seatBooked/20 border-seatBooked text-red-800 cursor-not-allowed",
 };

   export default function Seat({ seat, onClick }: Props) {
   const mineStyle = seat.locked_by_me
         ? "bg-seatMine/20 border-seatMine text-blue-800 cursor-pointer ring-2 ring-seatMine"
       : STATUS_STYLES[seat.status];

       const disabled = seat.status === "booked" || (seat.status === "locked" && !seat.locked_by_me);

   
       return (
    
       <button
      
       disabled={disabled}
         onClick={() => onClick(seat)}
         title={`${seat.label} — ${seat.status}`}
      
     className={`w-9 h-9 text-xs font-medium rounded border-2 flex items-center justify-center transition ${mineStyle}`}
    >
         {seat.label}
     </button>
  );
}
