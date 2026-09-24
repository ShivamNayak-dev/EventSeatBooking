/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        seatAvailable: "#22c55e",
        seatLocked: "#f59e0b",
        seatBooked: "#ef4444",
        seatMine: "#3b82f6",
      },
    },
  },
  plugins: [],
};
