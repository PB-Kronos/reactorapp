"use client";

import { MadeWithDyad } from "@/components/made-with-dyad";
import { useRouter } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to Reactor Simulator App</h1>
        <p className="text-lg text-gray-600 mb-6">
          Explore the power of nuclear reactors with our interactive simulator.
        </p>
        <a
          href="/reactor"
          className="inline-block bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 transition-colors"
        >
          Go to Reactor Simulator
        </a>
      </div>
      <MadeWithDyad />
    </div>
  );
};

export default Index;