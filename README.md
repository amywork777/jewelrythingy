# 3D Model Generator

A web application that creates detailed 3D models from text descriptions or images. Perfect for characters, creatures, and organic shapes.

## Features

- **Text to 3D**: Generate 3D models from text descriptions
- **Image to 3D**: Generate 3D models from uploaded images
- **Manufacturability-Enhanced Image**: Use optimization to analyze images and generate manufacturing-enhanced 3D models
- **Voice Input**: Record voice descriptions for text inputs
- **STL Download**: Convert and download models in STL format for 3D printing
- **3D Preview**: View the generated STL models directly in the browser

## Environment Variables

This project requires the following environment variables:

### Required

- `TRIPO_API_KEY`: API key for the Tripo3D service (required for model generation)

### Optional

- `OPENAI_API_KEY`: API key for OpenAI (required for the Manufacturability-Enhanced Image feature)

## Deployment on Vercel

When deploying to Vercel, make sure to add the environment variables in the Vercel dashboard:

1. Go to your project settings in Vercel
2. Navigate to the "Environment Variables" section
3. Add the following environment variables:
   - `TRIPO_API_KEY`: Your Tripo3D API key
   - `OPENAI_API_KEY`: Your OpenAI API key (if you want to use the Manufacturability-Enhanced Image feature)

If the `OPENAI_API_KEY` is not provided, the application will still function, but the Manufacturability-Enhanced Image feature will use a simplified fallback mechanism.

## Local Development

1. Clone the repository
2. Copy `.env.example` to `.env.local` and fill in your API keys
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run the development server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Technologies Used

- Next.js
- TypeScript
- React
- Three.js
- Tailwind CSS
- OpenAI API
- Tripo3D API 