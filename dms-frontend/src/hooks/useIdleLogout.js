import { useEffect, useRef } from "react";
import { toast } from "react-toastify";

export default function useIdleLogout(timeoutMinutes) {
  const timer = useRef();

  useEffect(() => {
    if (timeoutMinutes === 0) return;           // “Never”

    const reset = () => {
      clearTimeout(timer.current);
      timer.current = setTimeout(handle, timeoutMinutes * 60 * 1000);
    };

    const handle = () => {
      toast.info(`Keluar otomatis setelah ${timeoutMinutes} menit tidak aktif`);
      localStorage.clear();
      window.location.href = "/login";
    };

    // user activity listeners
    const events = ["click", "keydown", "mousemove", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset));
    reset(); // initial start

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      clearTimeout(timer.current);
    };
  }, [timeoutMinutes]);
}
