import React, { useState, useCallback, useMemo } from 'react';
import { ArrowLeft, Camera, Github, Globe, Linkedin } from 'lucide-react';
import { EditProfileModal } from '../components/Profile/EditProfileModal';
import type { ProfileData } from '../types/Profile';

const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80';

const initialData: ProfileData = {
  name: 'John Doe',
  profession: 'Senior Software Engineer',
  email: 'john.doe@example.com',
  phone: '+1 (555) 123-4567',
  location: 'San Francisco, CA',
  username: '@johndoe',
  bio: 'Passionate software engineer with 5+ years of experience in full-stack development.',
  github: 'github.com/johndoe',
  linkedin: 'linkedin.com/in/johndoe',
  website: 'johndoe.dev',
  skills: ['React', 'TypeScript', 'Node.js', 'Python', 'AWS'],
};

export default function EditProfilePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [profileImage, setProfileImage] = useState(DEFAULT_IMAGE);
  const [profileData, setProfileData] = useState<ProfileData>(initialData);

  const onBack = useCallback(() => window.history.back(), []);
  const onImageEditClick = useCallback(() => setIsModalOpen(true), []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const { name, value } = e.target;
      setProfileData(prev => ({ ...prev, [name]: value }));
    },
    []
  );

  const handleSkillsChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const skills = e.target.value.split(',').map(skill => skill.trim());
      setProfileData(prev => ({ ...prev, skills }));
    },
    []
  );

  const handleSelectNewImage = useCallback(() => {
    const newImageUrl = prompt('Enter new image URL (for demo purposes):');
    if (newImageUrl) {
      setProfileImage(newImageUrl);
      setIsModalOpen(false);
    }
  }, []);

  const handleRemoveImage = useCallback(() => {
    setProfileImage(DEFAULT_IMAGE);
    setIsModalOpen(false);
  }, []);

  const skillsString = useMemo(() => profileData.skills.join(', '), [profileData.skills]);

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4">
          <div className="h-16 flex items-center justify-between">
            <button
              onClick={onBack}
              className="flex items-center text-gray-700 hover:text-gray-900"
            >
              <ArrowLeft size={24} className="mr-2" />
              <span className="text-lg font-medium">Edit Profile</span>
            </button>
            <button
              onClick={onBack}
              className="text-blue-500 font-semibold hover:text-blue-600"
            >
              Done
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Profile Image Section */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <img
              src={profileImage}
              alt="Profile"
              className="w-32 h-32 rounded-full object-cover border border-gray-200"
            />
            <button
              onClick={onImageEditClick}
              className="absolute bottom-0 right-0 bg-blue-500 p-2 rounded-full text-white hover:bg-blue-600 transition-colors shadow-lg"
            >
              <Camera size={18} />
            </button>
          </div>
          <button
            onClick={onImageEditClick}
            className="text-blue-500 font-medium hover:text-blue-600"
          >
            Change profile photo
          </button>
        </div>

        {/* Sections */}
        <EditInputSection label="Name" name="name" value={profileData.name} onChange={handleChange} />
        <EditInputSection label="Username" name="username" value={profileData.username} onChange={handleChange} />
        <EditInputSection label="Profession" name="profession" value={profileData.github || ""}  onChange={handleChange} />

        <div className="border-b border-gray-200 pb-6">
          <div className="flex">
            <span className="w-32 text-sm font-medium text-gray-700">Bio</span>
            <textarea
              name="bio"
              value={profileData.bio}
              onChange={handleChange}
              rows={4}
              className="flex-1 px-3 py-2 border-0 focus:ring-0 text-base resize-none"
              placeholder="Write a short bio..."
            />
          </div>
        </div>

        {/* Contact Information */}
        <SectionTitle title="Contact Information" />
        <EditInputSection label="Email" name="email" value={profileData.email} onChange={handleChange} type="email" />
        <EditInputSection label="Phone" name="phone" value={profileData.phone || ""} onChange={handleChange} type="tel" />
        <EditInputSection label="Location" name="location" value={profileData.location|| ""} onChange={handleChange} />

        {/* Social Links */}
        <SectionTitle title="Social Links" />
        <EditInputSection icon={<Github size={16} className="mr-2" />} label="GitHub" name="github" value={profileData.github || ""}  onChange={handleChange} />
        <EditInputSection icon={<Linkedin size={16} className="mr-2" />} label="LinkedIn" name="linkedin" value={profileData.linkedin || ""} onChange={handleChange} />
        <EditInputSection icon={<Globe size={16} className="mr-2" />} label="Website" name="website" value={profileData.website || ""}  onChange={handleChange} />

        {/* Skills */}
        <SectionTitle title="Professional Skills" />
        <div className="space-y-2">
          <input
            type="text"
            value={skillsString}
            onChange={handleSkillsChange}
            className="w-full px-3 py-2 border-0 focus:ring-0 text-base"
            placeholder="Add skills (comma-separated)"
          />
          <p className="text-sm text-gray-500">Current skills: {skillsString}</p>
        </div>
      </div>

      <EditProfileModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSelectNewImage={handleSelectNewImage}
        onRemoveImage={handleRemoveImage}
      />
    </div>
  );
}

// Component for rendering labeled input row
const EditInputSection = ({
  label,
  name,
  value,
  onChange,
  type = 'text',
  icon,
}: {
  label: string;
  name: keyof ProfileData;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  icon?: React.ReactNode;
}) => (
  <div className="flex items-center border-b border-gray-100 py-3">
    <span className="w-32 flex items-center text-sm font-medium text-gray-700">
      {icon}
      {label}
    </span>
    <input
      type={type}
      name={name}
      value={value}
      onChange={onChange}
      className="flex-1 px-3 py-2 border-0 focus:ring-0 text-base"
      placeholder={`Enter your ${label.toLowerCase()}`}
    />
  </div>
);

// Section Title
const SectionTitle = ({ title }: { title: string }) => (
  <h3 className="text-base font-semibold mt-8 mb-4">{title}</h3>
);
