import React from "react";

interface AppButtonProps {
  label: string;
  color: string;
  action?: string;
}

const AppButton: React.FC<AppButtonProps> = ({ 
  label, 
  color, 
  action 
}) => {
  const handleClick = () => {
    if (action) {
      alert(`Button action: ${action}`);
    }
  };

  return (
    <button
      style={{
        backgroundColor: color,
        padding: "10px 18px",
        color: "#fff",
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: 500,
        transition: "opacity 0.2s",
      }}
      onClick={handleClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = "0.9";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = "1";
      }}
    >
      {label}
    </button>
  );
};

export default AppButton;