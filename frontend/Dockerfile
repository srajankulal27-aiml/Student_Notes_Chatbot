# Use official Node.js runtime as parent image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy dependency definition files
COPY package*.json ./

# Install npm dependencies
RUN npm install

# Copy all source files
COPY . .

# Expose port for Vite development server
EXPOSE 5173

# Start Vite dev server in host-exposed mode so it responds outside the container
CMD ["npm", "run", "dev", "--", "--host"]
