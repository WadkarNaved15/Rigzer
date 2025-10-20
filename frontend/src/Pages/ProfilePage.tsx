// src/components/Profile.tsx

import React from 'react';
import {Header} from "../components/Header";
import TickerBar from "../components/Home/TickerBar";
import MessagingComponent from "../components/Home/Message"

const Profile: React.FC = () => {
  return (
    <div className="bg-black text-white min-h-screen font-sans">
      <Header />
      <TickerBar />
      <MessagingComponent />
      <div className="max-w-4xl mx-auto bg-gradient-to-br from-[#1F4D44] to-[#3D7A6E] rounded-lg shadow-2xl overflow-hidden">
        {/* Profile Header Section */}
        <div className="relative h-40 bg-gray-800 ">
          <img
            src="https://images.unsplash.com/photo-1517457210714-7292671b5695?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w1ODMyNjl8MHwxfHNlYXJjaHw0fHxsaW5rZWRpbiUyMGJhY2tncm91bmR8ZW58MHx8fHwxNzA3OTM2ODc2fDA&ixlib=rb-4.0.3&q=80&w=1080"
            alt="Cover"
            className="w-full h-full object-cover"
          />
          <div className="absolute -bottom-16 left-8">
            <img
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w1ODMyNjl8MHwxfHNlYXJjaHwxfHxwcm9maWxlJTIwcGljdHVyZXxlbnwwfHx8fDE3MDc5MzY5MDJ8MA&ixlib=rb-4.0.3&q=80&w=150"
              alt="Profile"
              className="w-32 h-32 rounded-full border-4 border-white shadow-lg"
            />
          </div>
        </div>

        {/* Profile Info Section */}
        <div className="p-8 pt-20 bg-gradient-to-br from-[#1F4D44] to-[#3D7A6E]">
          <h1 className="text-3xl font-bold">John Doe</h1>
          <p className="text-xl text-gray-200 mt-1">Senior Software Engineer</p>
          <p className="text-gray-300 mt-2">
            San Francisco, California, United States • <span className="text-blue-300 cursor-pointer hover:underline">Contact info</span>
          </p>
          <div className="flex items-center space-x-4 mt-4">
            <button className="bg-white hover:bg-gray-200 text-[#1F4D44] px-6 py-2 rounded-full font-semibold transition duration-200">
              Open to
            </button>
            <button className="bg-transparent border border-white text-white px-6 py-2 rounded-full font-semibold transition duration-200 hover:bg-white hover:text-[#1F4D44]">
              Add profile section
            </button>
            <button className="bg-transparent border border-white text-white px-6 py-2 rounded-full font-semibold transition duration-200 hover:bg-white hover:text-[#1F4D44]">
              More
            </button>
          </div>
        </div>

        {/* About Section */}
        <div className="border-t border-gray-700 p-8 bg-gradient-to-br from-[#1F4D44] to-[#3D7A6E]">
          <h2 className="text-2xl font-bold mb-4">About</h2>
          <p className="text-gray-300 leading-relaxed">
            I am a highly motivated and results-oriented Senior Software Engineer with over 10 years of experience in developing and deploying scalable web applications. I have a strong background in full-stack development, with expertise in React, Node.js, and TypeScript. I am passionate about creating clean, efficient, and maintainable code.
          </p>
        </div>

        {/* Experience Section */}
        <div className="border-t border-gray-700 p-8 bg-gradient-to-br from-[#1F4D44] to-[#3D7A6E]">
          <h2 className="text-2xl font-bold mb-4">Experience</h2>
          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <img
                src="https://images.unsplash.com/photo-1623048928038-0382902b7941?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w1ODMyNjl8MHwxfHNlYXJjaHwzMHx8Y29tcGFueSUyMGxvZ298ZW58MHx8fHwxNzA3OTM3MDE3fDA&ixlib=rb-4.0.3&q=80&w=60"
                alt="Company Logo"
                className="w-12 h-12 rounded"
              />
              <div>
                <h3 className="text-lg font-semibold">Senior Software Engineer</h3>
                <p className="text-gray-400">Google</p>
                <p className="text-gray-500 text-sm">Jan 2020 - Present • 5 years</p>
                <p className="text-gray-300 mt-2">
                  Led the development of a new microservices architecture, improving system performance by 30%. Mentored junior developers and contributed to code reviews and architectural decisions.
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-4">
              <img
                src="https://images.unsplash.com/photo-1549605330-8041c27e366b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w1ODMyNjl8MHwxfHNlYXJjaHw1NXx8Y29tcGFueSUyMGxvZ298ZW58MHx8fHwxNzA3OTM3MDMzfDA&ixlib=rb-4.0.3&q=80&w=60"
                alt="Company Logo"
                className="w-12 h-12 rounded"
              />
              <div>
                <h3 className="text-lg font-semibold">Software Engineer</h3>
                <p className="text-gray-400">Microsoft</p>
                <p className="text-gray-500 text-sm">Jun 2016 - Dec 2019 • 3 years 7 mos</p>
                <p className="text-gray-300 mt-2">
                  Developed and maintained front-end features for the Azure platform using React and TypeScript. Collaborated with product managers and designers to translate requirements into technical solutions.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Education Section */}
        <div className="border-t border-gray-700 p-8  bg-gradient-to-br from-[#1F4D44] to-[#3D7A6E]">
          <h2 className="text-2xl font-bold mb-4">Education</h2>
          <div className="flex items-start space-x-4">
            <img
              src="https://images.unsplash.com/photo-1624555139046-213908f51a70?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w1ODMyNjl8MHwxfHNlYXJjaHw1fHx1bml2ZXJzaXR5JTIwbG9nb3xlbnwwfHx8fDE3MDc5MzcwNDB8MA&ixlib=rb-4.0.3&q=80&w=60"
              alt="School Logo"
              className="w-12 h-12 rounded"
            />
            <div>
              <h3 className="text-lg font-semibold">Stanford University</h3>
              <p className="text-gray-400">Master of Science - MS, Computer Science</p>
              <p className="text-gray-500 text-sm">2014 - 2016</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;