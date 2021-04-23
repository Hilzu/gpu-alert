FROM amazonlinux:2

WORKDIR /opt/app
ENV NODE_ENV production

RUN curl -fsSL https://rpm.nodesource.com/setup_14.x | bash -
RUN yum install -y gcc-c++ make nodejs zip
RUN npm install -g npm@7

COPY package.json .
COPY package-lock.json .
RUN npm ci

COPY . .
RUN zip -r lambda.zip .
