FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install


ENV NEXT_PUBLIC_AUTH_API_URL=http://localhost:3001
ENV NODE_ENV=production

COPY . .

RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
