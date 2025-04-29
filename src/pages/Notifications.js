import { useState, useEffect, useMemo } from "react";
import io from "socket.io-client";
import "../styles.css";

function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const user = useMemo(() => JSON.parse(localStorage.getItem("user")), []);

  // Notification type mapping
  const notificationTitles = {
    custom_job_offer: "New Custom Job Offer",
    custom_job_approved: "Custom Job Approved",
    custom_job_declined: "Custom Job Declined",
    new_review: "New Review Received",
    bid_submitted: "Bid Submitted",
    bid_approved: "Bid Approved",
    job_completed: "Job Completed",
    new_job: "New Job Posted",
  };

  // Initialize WebSocket
  useEffect(() => {
    if (!user?.id) return;

    const socket = io("http://localhost:5000", { withCredentials: true });
    socket.on("connect", () => {
      socket.emit("join", user.id.toString());
    });
    socket.on("notification", (notification) => {
      setNotifications((prev) => [notification, ...prev]);
    });

    return () => {
      socket.disconnect();
    };
  }, [user?.id]);

  // Fetch initial notifications
  useEffect(() => {
    if (!user?.id) return;

    fetch(`http://localhost:5000/notifications?user_id=${user.id}`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setNotifications(data))
      .catch((err) => console.error("Error fetching notifications:", err));
  }, [user?.id]);

  // Mark notification as read
  const markAsRead = (id) => {
    fetch(`http://localhost:5000/notifications/${id}/read`, {
      method: "POST",
      credentials: "include",
    })
      .then(() => {
        setNotifications((prev) =>
          prev.map((notif) =>
            notif.id === id ? { ...notif, is_read: true } : notif
          )
        );
      })
      .catch((err) => console.error("Error marking notification as read:", err));
  };

  // Toggle overlay
  const toggleOverlay = () => {
    setIsOpen(!isOpen);
  };

  // Close overlay when clicking outside
  const handleOverlayClick = (e) => {
    if (e.target.className === "notification-overlay") {
      setIsOpen(false);
    }
  };

  // Calculate unread count
  const unreadCount = notifications.filter((notif) => !notif.is_read).length;

  // Format timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!user) return null;

  return (
    <div className="notifications-container">
      <div className="notification-bell" onClick={toggleOverlay}>
        🔔
        {unreadCount > 0 && (
          <span className="notification-badge">{unreadCount}</span>
        )}
      </div>
      {isOpen && (
        <div className="notification-overlay" onClick={handleOverlayClick}>
          <div className="notification-dropdown">
            {notifications.length === 0 ? (
              <div className="notification-empty">No notifications yet</div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`notification-item ${notif.is_read ? "" : "unread"}`}
                  onClick={() => !notif.is_read && markAsRead(notif.id)}
                >
                  <span className="notification-type">
                    {notificationTitles[notif.type] || notif.type}
                  </span>
                  <span className="notification-message">{notif.message}</span>
                  <span className="notification-time">
                    {formatTime(notif.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Notifications;