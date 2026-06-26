FROM node:20-bullseye-slim

RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    pkg-config \
    libsqlite3-dev \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpixman-1-dev \
    libpng-dev \
    fontconfig \
    fonts-freefont-ttf \
    ffmpeg \
    git \
    curl \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

RUN rm -f package-lock.json && \
    npm install --legacy-peer-deps --no-fund --no-audit && \
    npm rebuild canvas sqlite3 --build-from-source

COPY . .

RUN chmod +x /app/entrypoint.sh

EXPOSE 3000

CMD ["/bin/sh", "/app/entrypoint.sh"]
