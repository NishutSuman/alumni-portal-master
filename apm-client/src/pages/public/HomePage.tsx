// src/pages/public/HomePage.tsx
import React from 'react'

const HomePage = () => {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-guild-50 to-purple-50 dark:from-gray-900 dark:to-gray-800 py-20">
        <div className="container-guild">
          <div className="text-center max-w-4xl mx-auto">
            <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
              Welcome to <span className="text-gradient-guild">GUILD</span>
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
              Your Professional Alumni Network - Connecting Minds, Building Futures
            </p>
            <div className="flex justify-center space-x-4">
              <a href="/auth/register" className="btn-guild">Join the Guild</a>
              <a href="/events" className="btn-outline-guild">Explore Events</a>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="container-guild">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Why Choose GUILD?
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="glass-card p-8 text-center">
              <div className="w-16 h-16 bg-guild-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl text-white">🤝</span>
              </div>
              <h3 className="text-xl font-semibold mb-4 dark:text-white">Network</h3>
              <p className="text-gray-600 dark:text-gray-300">Connect with alumni worldwide</p>
            </div>
            <div className="glass-card p-8 text-center">
              <div className="w-16 h-16 bg-guild-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl text-white">📅</span>
              </div>
              <h3 className="text-xl font-semibold mb-4 dark:text-white">Events</h3>
              <p className="text-gray-600 dark:text-gray-300">Join exclusive alumni events</p>
            </div>
            <div className="glass-card p-8 text-center">
              <div className="w-16 h-16 bg-guild-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl text-white">🩸</span>
              </div>
              <h3 className="text-xl font-semibold mb-4 dark:text-white">LifeLink</h3>
              <p className="text-gray-600 dark:text-gray-300">Save lives through blood donation</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

export default HomePage
