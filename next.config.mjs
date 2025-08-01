let userConfig = undefined
try {
  userConfig = await import('./v0-user-next.config')
} catch (e) {
  // ignore error
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    domains: ['tripo-data.cdn.bcebos.com'],
  },
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei', 'expo', 'expo-asset', 'expo-gl', 'expo-file-system', 'react-native'],
  experimental: {
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    parallelServerCompiles: true,
  },
  // Configure webpack to handle Three.js properly
  webpack: (config) => {
    // Add support for importing glTF files
    config.module.rules.push({
      test: /\.(glb|gltf)$/,
      use: {
        loader: 'file-loader',
      },
    });

    // Enable transpilation for Three.js-related modules
    config.module.rules.push({
      test: /\.m?js$/,
      type: 'javascript/auto',
      resolve: {
        fullySpecified: false,
      },
    });

    return config;
  },
  // Configure environment variables that must be available on the server
  serverRuntimeConfig: {
    // Make sure these variables get properly passed to the server environment
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    TRIPO_API_KEY: process.env.TRIPO_API_KEY,
  },
  // Make Next.js pass our env variables to the browser
  env: {
    NEXT_PUBLIC_DEPLOYMENT_NAME: process.env.NEXT_PUBLIC_DEPLOYMENT_NAME || 'local',
  },
}

mergeConfig(nextConfig, userConfig)

function mergeConfig(nextConfig, userConfig) {
  if (!userConfig) {
    return
  }

  for (const key in userConfig) {
    if (
      typeof nextConfig[key] === 'object' &&
      !Array.isArray(nextConfig[key])
    ) {
      nextConfig[key] = {
        ...nextConfig[key],
        ...userConfig[key],
      }
    } else {
      nextConfig[key] = userConfig[key]
    }
  }
}

export default nextConfig
