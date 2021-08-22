# 복잡한 어플을 실제로 배포해보기

## Index

A. [개발 환경 부분](#a-개발-환경-부분)

1.  [섹션 설명](#1-섹션-설명)
2.  [Node JS 구성하기](#2-node-js-구성하기)
3.  [React JS 구성하기](#3-react-js-구성하기)
4.  [리액트 앱을 위한 도커 파일 만들기](#4-리액트-앱을-위한-도커-파일-만들기)
5.  [노드 앱을 위한 도커 파일 만들기](#5-노드-앱을-위한-도커-파일-만들기)
6.  [DB에 관해서](#6-db에-관해서)
7.  [MySQL을 위한 도커 파일 만들기](#7-mysql을-위한-도커-파일-만들기)
8.  [Nginx를 위한 도커 파일 만들기](#8-nginx를-위한-도커-파일-만들기)
9.  [Docker Compose 파일 작성하기](#9-docker-compose-파일-작성하기)
10. [Docker Volume을 이용한 데이터 베이스 데이터 유지하기](#10-docker-volume을-이용한-데이터-베이스-데이터-유지하기)

B. [테스트 배포 부분](#b-테스트-배포-부분)

1.  [섹션 설명 (테스트 배포)](#1-섹션-설명-테스트-배포)
2.  [도커 환경의 MySQL 부분 정리하기](#2-도커-환경의-mysql-부분-정리하기)
3.  [GitHub에 소스 코드 올리기](#3-github에-소스-코드-올리기)
4.  [Travis CI Steps](#4-travis-ci-steps)
5.  [travis yml 파일 작성하기](#5-travis-yml-파일-작성하기)
6.  [Dockerrun.aws.json에 대하여](#6-dockerrun-aws-json에-대하여)
7.  [Dockerrun.aws.json 파일 작성하기](#7-dockerrun-aws-json-파일-작성하기)
8.  [다중 컨테이너 앱을 위한 Elastic Beanstalk 환경 생성](#8-다중-컨테이너-앱을-위한-elastic-beanstalk-환경-생성)
9.  [VPC 설정하기](#9-vpc-설정하기)
10. [MySQL을 위한 AWS RDS 생성하기](#10-mysql을-위한-aws-rds-생성하기)
11. [Security Group 생성하기](#11-security-group-생성하기)
12. [Security Group 적용하기](#12-security-group-적용하기)
13. [EB와 RDS 소통을 위한 환경 변수 설정하기](#13-eb와-rds-소통을-위한-환경-변수-설정하기)
14. [travis.yml 파일 작성하기 (배포 부분)](#14-travis-yml-파일-작성하기-배포-부분)
15. [Travis CI의 AWS 접근을 위한 API Key 생성](#15-travis-ci의-aws-접근을-위한-api-key-생성)

---

## A. 개발 환경 부분

### 1. 섹션 설명

이전에 React 하나로 개발했다.
이제 React뿐만 아니라
Node.js, MySQL 및 Nginx를 적용한 애플리케이션을 작성한다.

Nginx의 Proxy 기능을 사용하여 설계한다.
단순 정적 파일로 제공하고 포트 분할을 통해 제작하는 간단한 방법이 있으나,
그 방법은 단순하고 지금이라도 할 수 있을 것이다.
Nginx의 Proxy를 사용하면서 Apache Tomcat과의 차이점도 생각하자.

Client와 Application 사이에 Proxy Nginx(port 80)을 두어,
Client의 요청은 Proxy 서버가 받아 로드 밸런싱과 유사한 기능을 구현한다.
이 경우 port 매핑을 따로 해줄 필요가 없다.
하지만 Proxy 서버를 사용한다는 것부터 환경 설정이 다소 복잡하다.

### 2. Node JS 구성하기

1.  `npm init`으로 backend 폴더에 Project를 생성한다.
2.  `package.json` 파일을 수정한다.
    ```js
    {
      "name": "backend",
      "version": "1.0.0",
      "description": "",
      "main": "index.js",
      "scripts": {
        "test": "echo \"Error: no test specified\" && exit 1",
        "start": "node server.js",
        // nodemon을 이용하여 express 서버를 시작할 떄 사용
        "dev": "nodemon server.js"
      },
      "author": "jihogrammer",
      "license": "ISC",
      "dependencies": {
        "express": "^4.16.3",
        "mysql": "^2.16.0",
        "nodemon": "^1.18.3",
        // Client에서 오는 요청의 본문을 해석하는 미들웨어
        "body-parser": "^1.19.0"
      }
    }
    ```
3.  `server.js` 작성
    ```js
    // 필요한 모듈들을 가져오기
    const expresss = require("express");
    const bodyParser = require("body-parser");

    // express 서버 생성
    const app = expresss();

    // JSON 형태로 오는 요청의 본문을 해석할 수 있게 설정
    app.use(bodyParser.json());

    app.listen(5000, () => {
        console.log("애플리케이션이 5000번 포트에서 시작되었습니다.");
    });
    ```
4.  `db.js` 작성하고 `server.js`에 등록
    ```js
    const mysql = require("mysql");
    const pool = mysql.createPool({
        connectionLimit: 10,
        host: "mysql",
        user: "root",
        password: "1234",
        database: "myapp"
    });

    exports.pool = pool;
    ```
    ```js
    ...
    const bodyParser = require("body-parser");

    const db = require("./db");

    const app = expresss();
    ...
    ```
5.  애플리케이션에 필요한 두 가지 API 작성
    ```js
    // DB list 테이블에 있는 모든 데이터를 프론트에 보낸다.
    app.get("/api/values", function (req, res) {
        // DB에서 모든 정보 가져오기
        db.pool.query("SELECT * FROM list;",
            (err, results, fields) => {
                if (err) return res.status(500).send(err);
                return res.json(results)
            })
    });

    // Client에서 입력한 값을 DB에 Insert
    app.post("/api/value", (req, res, next) => {
        db.pool.query(`INSERT INTO list (value) VALUES("${req.body.value}")`,
            (err, results, fields) => {
                if (err) return res.status(500).send(err);
                return res.json({ success: true, value: req.body.value });
            })
    });
    ```

### 3. React JS 구성하기

1.  `npx create-react-app frontend` 명령어로 프로젝트 생성
2.  frontend의 `App.js`에서 `input`과 `button` 생성
    ```html
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <div className="container">
          <form className="example" onSubmit>
            <input
              type="text"
              placeholder="입력해주세요..."
            />
            <button type="submit">확인</button>
          </form>
        </div>
      </header>
    </div>
    ```
3.  `App.css`에 스타일 추가
    ```css
    .container {
        width: 375px;
    }

    form.example input {
        padding: 10px;
        font-size: 17px;
        border: 1px solid gray;
        float: left;
        width: 74%;
        background: #f1f1f1;
    }

    form.example button {
        float: left;
        width: 20%;
        padding: 10px;
        background: #2196F3;
        color: white;
        font-size: 17px;
        border: 1px solid gray;
        border-left: none;
        cursor: pointer;
    }

    form.example button:hover {
        background: #0b7dda;
    }

    form.example::after {
        content: "";
        clear: both;
        display: table;
    }
    ```
4.  데이터 흐름을 위한 State 생성
    ```js
    // useState를 사용하기 위해 react 라이브러리에서 받아옴
    import React, { useState } from "react";
    import axios from "axios";
    import logo from "./logo.svg";
    import "./App.css";

    function App() {
        // DB의 값을 가져와 화면에 보여주기 위해 State에 준비
        const [list, setList] = useState([]);
        // input 박스에 입력한 값이 이 state에 들어감
        const [value, setValue] = useState("");
        ...
    }
    ```
5.  DB에서 데이터를 가져오기 위해 useEffect 적용
    ```js
    import React, { useState, useEffect } from "react";
    ...
    function App() {
        const [list, setList] = useState([]);
        const [value, setValue] = useState("");
        // 여기서 DB에 있는 값을 읽는다.
        useEffect(() => {
            
        }, [])
    }
    ```
6.  기타 다른 부분 처리하기
    -   `/api/values`
        ```js
        useEffect(() => {
            axios.get("/api/values")
            .then(response => {
                console.log(response);
                setList(response.data);
            });
        }, [])
        ```
    -   `changeHandler`: input 박스에 입력할 때
        `onChange` 이벤트가 발생하면 value State를 변화시킴
        ```js
        const changeHandler = (event) => {
            setValue(event.currentTarget.value);
        };
        ```
        ```html
        <input
            type="text"
            placeholder="입력해주세요..."
            onChange={changeHandler}
        />
        ```
    -   `submitHandler`: input 박스에 입력이 되면...
        ```js
        const submitHandler = (event) => {
            event.preventDefault();
            axios.post("/api/value", {value: value})
                .then(response => {
                    if (response.data.success) {
                        console.log(response);
                        setList([...list, response.data]);
                        setValue("");
                    } else {
                        alert("데이터 DB 저장을 실패했습니다.")
                    }
                });
        };
        ```
        ```js
        // 확인 버튼 클릭 시 이벤트 호출
        <form className="example" onSubmit={submitHandler}>
        ```
    -   list 목록 렌더링
        ```js
        { list && list.map((tuple, index) => (
            <li key={index}>{tuple.value}</li>
        ))}
        ```
    -   input 박스 변수에 매핑
        ```js
        // onChange: 값 입력할 때마다 이벤트 발생
        // value: State의 value로 컨트롤
        <input
            type="text"
            placeholder="입력해주세요..."
            onChange={changeHandler}
            value={value}
        />
        ```

### 4. 리액트 앱을 위한 도커 파일 만들기

1.  frontend 폴더에 dockerfile 생성
2.  `dockerfile.dev`
    ```dockerfile
    # 베이스이미지를 도커허브에서 가져온다.
    FROM node:alpine
    # 해당 앱의 소스코드들이 위치하게 될 디렉토리
    WORKDIR /app
    # 소스코드가 바뀔 때마다 종속성까지 다시 복사하는 것을 막음
    COPY package.json .
    # 먼저 종속성을 다운받고 나머지 파일들을 복사
    RUN npm install
    # 종속성을 제외한 나머지 파일 복사
    COPY . .
    # 컨테이너 실행 시 사용할 명령어
    CMD ["npm", "run", "start"]
    ```
3.  `dockerfile`
    ```dockerfile
    # Nginx가 제공할 빌드된 파일들을 생성
    FROM node:alpine as builder
    WORKDIR /app
    COPY package.json .
    RUN npm install
    COPY . .
    RUN npm run build

    # Nginx로 위 stage에서 생성한 파일들을 제공
    # default.conf 설정을 Nginx 컨테이너 안에 복사하여 설정 변경
    FROM nginx
    EXPOSE 3000
    COPY ./nginx/default.conf /etc/nginx/conf.d/defalut.conf
    COPY --from=builder /app/build /usr/share/nginx/html
    ```

#### Nginx

현재 여기서 다루는 Nginx는 Proxy 서버가 아닌
React를 위한 Nginx 서버에 대한 설정이다.
`nginx/default.conf`에 대한 설명은 다음과 같다.

```bash
server {
  listen 3000;

  # "/" 요청으로 들어올 경우
  location / {
    # HTML 파일이 위치할 Root Directory 설정
    root /usr/share/nginx/html;
    # 사이트의 index 페이지로 설정할 파일명 설정
    index index.html index.htm;
    # React Router를 사용하여 페이지 간 이동 설정
    try_files $uri $uri/ /index.html;
  }
}
```

`try_files $uri $uri/ /index.html;`은 React를 위한 설정이다.
React는 SPA 기반의 FrontEnd Library로
index.html 하나의 정적 파일을 가진다.
만약 다른 uri로 접근 시도 시 nginx는 제대로 라우팅할 수 없다.
따라서 React에서 설정하지 않은 url 요청이 들어올 경우
예외 처리로 임의로 메인페이지로 이동하게 하는 설정이다.

### 5. 노드 앱을 위한 도커 파일 만들기

1.  `dockerfile.dev`
    ```dockerfile
    FROM node:alpine
    WORKDIR /app
    COPY package.json .
    RUN npm install
    COPY . .
    CMD ["npm", "run", "dev"]
    ```
    `start`가 아닌 `dev`인 이유는 코드 변경될 때마다
    바로 반영을 시켜줄 수 있도록 nodemon이 관리하게 설정한다.
2.  `dockerfile`
    ```dockerfile
    FROM node:alpine
    WORKDIR /app
    COPY package.json .
    RUN npm install
    COPY . .
    CMD ["npm", "run", "start"]
    ```

### 6. DB에 관해서

-   개발 환경 : 도커 환경 이용
-   운영 환경 : AWS RDS 이용

DB 작업은 중요한 데이터들을 보관하고 이용하는 부분이다.
조금의 실수라도 안 좋은 결과를 초래할 수 있다.
따라서 실제 중요한 데이터를 다루는 운영 환경에서는
더욱 안정적인 AWS RDS를 이용하여 DB를 구성해본다.
이 방법이 실제 실무에서 더 보편적으로 쓰이는 방법이다.

-   개발 환경
    ```text
    Client -- Nginx --+-- Front (3000) --+-- Nginx
                      |                  |
                      |                  +-- static built files
                      |
                      +-- Server (5000) -- MySQL (3063)
    ```
-   운영 환경 : AWS Relational Database Service
    ```text
    < Elastic Beanstalk >
    Client -- Nginx --+-- Front (3000) --+-- Nginx
                      |                  |
                      |                  +-- static built files
                      |
                      +-- Server (5000)
                            |
    ------------------------+----------------------------------
    < AWS RDS >             |
                          MySQL (3063)
    ```

### 7. MySQL을 위한 도커 파일 만들기

1.  `mysql` 디렉토리 생성 후 그 안에 `dockerfile` 생성
2.  `dockerfile` 작성
    ```dockerfile
    # 베이스 이미지를 도커 허브에서 가져온다.
    FROM mysql:5.7
    ```
3.  MySQL 시작 시 필요한 Schema 및 Table 생성  
    `mysql/sql/initialize.sql` 생성
4.  `initialize.sql` 작성
    ```sql
    DROP DATABASE IF EXISTS myapp;

    CREATE DATABASE myapp;
    USE myapp;

    CREATE TABLE list (
        id INTEGER AUTO_INCREMENT,
        value TEXT,
        PRIMARY KEY (id)
    );
    ```
    `server.js`에 있는 Schema 생성 부분은 주석 처리
5.  한글 인코딩 처리를 위해 `my.cnf` 파일 작성
    ```bash
    [mysqld]
    character-set-server=utf8

    [mysql]
    defualt-character-set=utf8

    [client]
    defualt-character-set=utf8
    ```
6.  `dockerfile`에 `my.cnf` 추가
    ```dockerfile
    ADD my.cnf /etc/mysql/conf.d/my.cnf
    ```
7.  실행 후 mysql status를 보면
    Server, DB, Client 등의 character set이
    `latin1`에서 `utf8`로 변경된다.

### 8. Nginx를 위한 도커 파일 만들기

>   Proxy Nginx에 대한 설정이다.

현재 Nginx가 쓰이는 곳은 두 곳이다.
하나는 Proxy, 다른 하나는 정적 파일을 제공하는 역할을 수행한다.
Client의 요청이 정적 파일을 요청하는 것인지,
API 호출을 요청하는 것인지 구분하여
FrontEnd(React)와 BackEnd(Node express)로 보낸다.

1. `default.conf` 작성
```bash
# "frontend", "backend" 이름은 docker-compose 파일에 명시한다.
# docker 환경이 아닐 경우 IP를 직접 입력해야 한다.

# 3000 포트에서 frontend가 동작한다는 것을 명시
upstream frontend {
  server frontend:3000;
}
# 5000 포트에서 backend가 동작한다는 것을 명시
upstream backend {
  server backend:5000;
}
server {
  # Nginx 서버 포트를 80으로 개통
  listen 80;
  # location에는 우선 순위가 있다.
  # "/"만 있을 경우 우선 순위가 가장 낮다.
  # 여기서는 "/api"를 먼저 찾고 없다면 "/"에서 찾는다.
  location / {
    proxy_pass http://frontend;
  }
  # /api로 들어오는 요청을 backend로 보낸다.
  location /api {
    proxy_pass http://backend;
  }
  # 이 부분이 없을 경우 "개발 환경'에서 에러가 발생한다.
  location /sockjs-node {
    proxy_pass http://frontend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
  }

}
```
2.  `dockerfile` 작성
```dockerfile
FROM nginx
# 작성한 설정 파일을 nginx에 넣어준다.
COPY default.conf /etc/nginx/conf.d/default.conf
```

### 9. Docker Compose 파일 작성하기

각 컨테이너를 위한 `dockerfile`을 작성했다.
이제 각 컨테이너를 묶어서 사용할 `docker-compose.yml`을 작성한다.

1.  `docker-compose.yml` 생성
    ```yml
    version: "3"
    services:
      frontend:
      nginx:
      backend:
      mysql:
    ```
2.  `frontend` 부분 작성
    ```yml
    frontend:
      # 개발 환경을 위한 dockerfile 위치 명시
      build:
        dockerfile: dockerfile.dev
        context: ./frontend
      # 코드 수정 시 바로 수정된 코드 반영을 위해 volume 사용
      volumes:
        - /app/node_modules
        - ./frontend:/app
      # React 종료 시 발생하는 버그를 잡음
      stdin_open: true
    ```
3.  `nginx` 부분 작성
    ```yml
    nginx:
      # 재시작 정책
        # no - 어떠한 상황에서도 재시작하지 않는다.
        # always - 항상 재시작
        # on-failure - on-failure 에러 코드 발생 시만 재시작
        # unless-stopped - 개발자가 임의로 멈출 때 빼고 항상 재시작
      restart: always
      build:
        dockerfile: dockerfile
        context: ./nginx
      ports:
        - 3000:80
    ```
4.  `backend` 부분 작성
    ```yml
    backend:
      # 필수 아님
      container_name: app_backend
      build:
        dockerfile: dockerfile.dev
        context: ./backend
      volumes:
        - /app/node_modules
        - ./backend:/app
    ```
5.  `mysql` 부분 작성
    ```yml
    mysql:
      build: ./mysql
      restart: unless-stopped
      container_name: app_mysql
      ports:
        - 3306:3306
      volumes:
        - ./mysql/mysql_data:/var/lib/mysql
        - ./mysql/sql:/docker-entrypoint-initdb.d/
      environment:
        MYSQL_ROOT_PASSWORD: 1234
        MYSQL_DATABASE: myapp
    ```

### 10. Docker Volume을 이용한 데이터 베이스 데이터 유지하기

```yml
mysql:
  build: ./mysql
  restart: unless-stopped
  container_name: app_mysql
  ports:
    - 3306:3306
  volumes:
    - ./mysql/mysql_data:/var/lib/mysql
    - ./mysql/sql:/docker-entrypoint-initdb.d/
  environment:
    MYSQL_ROOT_PASSWORD: 1234
    MYSQL_DATABASE: myapp
```

위에 volumes 부분이 무엇을 의미하는지 알아보자.
현재까지는 volume을 사용한 용도가 리액트나 노드에서
코드를 업데이트 할 때 바로 그 코드가 적용되게 할 때 사용했다.
여기서는 DB의 내용을 지금 컴퓨터에 저장해서
Docker Container가 사라져도 DB의 영속성은 유지되도록
따로 관리하는 방식이다.

>   그냥 데이터를 날려도 된다면 volume 설정을 안 해도 되겠지

1.  이미지로 컨테이너 생성
2.  컨테이너 생성 후 읽기 전용
3.  컨테이너 안에서의 변화
4.  변화된 데이터를 컨테이너 안에 저장
5.  컨테이너 삭제 시 컨테이너 안의 데이터 또한 삭제

이러한 문제 때문에 영속성이 필요한 데이터의 경우는
기존에 설정한 것처럼 volume을 사용한다.
하지만 추후 AWS RDS로 관리한다.

>   이러한 방식을 **호스트 파일 시스템**이라고 한다.

---

## B. 테스트 배포 부분

### 1. 섹션 설명 (테스트 배포)

Single Container 프로젝트에서는 직접 파일을 배포했는데,
이번에는 Docker Hub에 image를 전달하여 사용한다.
이 과정에서 image를 빌드하는 시간이 2번에서 1번으로 줄어든다.

### 2. 도커 환경의 MySQL 부분 정리하기

MySQL이 Docker 환경이 아닌 AWS RDS 환경으로 변경한다.

1.  `docker-compose.yml`에서 mysql 관련 부분 삭제
2.  mysql 디렉토리 삭제
    -   mysql 부분을 주석처리하면,
        docker-compose 시 알아서 해당 디렉터리는 무시한다.
3.  AWS에서 DB 생성 후 `db.js` 내용 적절하게 수정

### 3. GitHub에 소스 코드 올리기

[GitHub Repository](https://github.com/JihoDevOps/docker-fullstack-app)

### 4. Travis CI Steps

1.  GitHub에 소스 코드 Push
2.  Travis CI가 자동으로 코드를 Clone
3.  Clone 한 코드를 테스트
4.  테스트 성공 시 Docker Image Build
5.  빌드된 이미지들을 DockerHub로 업로드
6.  AWS EB에 DockerHub에 이미지를 올렸다고 알림
7.  AWS EB에서 DockerHub에 있는 이미지를 가져와 배포

5번에서 빌드된 이미지를 DockerHub에 올리고 AWS가 가져가므로,
EB 내에서 다시 빌드작업을 수행하지 않아도 된다.
DockerHub에서 유명한 이미지들을 다운받을 수 있고,
자신이 만든 이미지도 업로드할 수 있다.

1.  [Travis CI 사이트](https://www.travis-ci.com)로 이동
2.  Travis 홈페이지에서 해당 저장소를 활성화
    > Travis가 업데이트 되면서 방식이 조금 다름

### 5. travis yml 파일 작성하기

1.  `.travis.yml` 파일 생성
2.  Test 수행 준비
    -   애플리케이션이 도커 환경에서 실행하므로
        Travis CI에게 도커 환경으로 만든다고 선언
    -   구성된 도커 환경에서 dockerfile.dev를 이용하여 Image 생성
3.  Test 수행
4.  모든 프로젝트 운영버전 이미지 빌드
    -   테스트 성공 시 각 프로젝트의 운영버전 이미지 빌드하는 설정
5.  빌드된 이미지를 도커허브에 업로드
    -   도커허브에 빌드된 이미지를 넣어주기 위해 도커허브에 로그인
    -   빌드된 이미지 업로드
6.  배포
    -   AWS EB가 업데이트 된 이미지를 가져와 배포할 수 있게 설정

#### .travis.yml

```yml
# Define project language
language: generic

# Require permission
sudo: required

# Announce services type to Travis CI
services:
  - docker

before_install:
  # Build test image
  - docker build -t "$DOCKER_HUB_ID"/react-test-app -f ./frontend/dockerfile.dev ./frontend

script:
  # Run test
  - docker run -e CI=true "$DOCKER_HUB_ID"/react-test-app npm run test

after_success:
  # Build images
  - docker build -t "$DOCKER_HUB_ID"/docker-frontend ./frontend
  - docker build -t "$DOCKER_HUB_ID"/docker-backend ./backend
  - docker build -t "$DOCKER_HUB_ID"/docker-nginx ./nginx
  # Sign in DockerHub
  - echo "$DOCKER_HUB_PASSWORD" | docker login -u "$DOCKER_HUB_ID" --password-stdin
  # Push in DockerHub
  - docker push "$DOCKER_HUB_ID"/docker-frontend
  - docker push "$DOCKER_HUB_ID"/docker-backend
  - docker push "$DOCKER_HUB_ID"/docker-nginx
```

#### Travis CI에서 환경변수 설정

Go Travis CI →
Select Repository →
Click settings →
Add Environment Variables
([link](https://app.travis-ci.com/github/JihoDevOps/docker-fullstack-app/settings))

#### 환경변수 설정 후 git push 해서 테스트

-   테스트 코드 적절하게 수정
-   아직 AWS 연결은 하지 않았으므로
    정상적으로 DockerHub에 이미지가 업로드 되었는지
    [확인](https://hub.docker.com)

### 6. Dockerrun aws json에 대하여

`dockerrun.aws.json` 파일을 통해
AWS Elastic Beanstalk에서 애플리케이션을 작동할 수 있다.

#### 필요성

하나의 dockerfile은 EB가 스스로 처리할 수 있다.
하지만 지금 다루는 프로젝트처럼
이미지가 여러 개인 경우 따로 설정이 필요하다.

이번에는 Node, MySQL, Nginx 등을 위한 dockerfile이 각각 존재한다.
따라서 EB가 어떤 행동을 취할지 설정해야 한다.

#### 정의

Docker 컨테이너 세트를 EB 애플리케이션으로 배포하는 방법을 설명하는
Elastic Beanstalk 고유의 JSON 파일이다.
`Dockerrun.aws.json` 파일을 멀티컨테이너 Docker 환경에서 사용한다.

`Dockerrun.aws.json`은 환경에서 각 컨테이너
인스턴스(Docker 컨테이너를 호스트하는 Amazon EC2 인스턴스)에
배포할 컨테이너 및
탑재할 컨테이너의 호스트 인스턴스에서 생성할 데이터 볼륨을 설명한다.

#### 구조

```bash
+ EB
  + ECS (Elastic Container Service)
    + Task
      + Container
```

Task Definition, Container Definition을 명시해야 한다.

#### Task Definition

-   작업의 각 컨테이너에 사용할 도커 이미지
-   각 작업 또는 작업 내 컨테이너에서 사용할 CPU 및 메모리의 양
-   사용할 시작 유형으로서 해당 작업이 호스팅되는 인프라를 결정
-   작업의 컨테이너에 사용할 도커 네트워킹 모드
-   작업에 사용할 로깅 구성
-   컨테이너가 종료 또는 실패하더라도 작업이 계속 실행될지 여부
-   컨테이너 시작 시 컨테이너가 실행할 명령
-   작업의 컨테이너에서 사용할 데이터 볼륨
-   작업에서 사용해야 하는 IAM 역할

이 작업 정의를 등록하려면 Container Definition을 명시해야 한다.
그 Container Definition은 `dockerrun.aws.json`에 명시하여
Docker Daemon으로 전달된다.

### 7. Dockerrun aws json 파일 작성하기

1.  `dockerrun.aws.json` 파일 생성
2.  Container Definitions 작성

#### `

```js
{
  // Dockerrun version 2
  "AWSEBDockerrunVersion": 2,
  // Define Containers
  "containerDefinitions": [
    // Container
    {
      "name": "frontend",
      // Image at DockerHub
      "image": "jihogrammer/docker-frontend",
      // Link to other Container
      // 이름을 이용하여 Docker Compose를 통해 생성된
      // 다른 컨테이너에서 접근 가능
      "hostname": "frontend",
      // If this Container failed, stop or continue
      // 실패할 경우 작업을 중지하려면 true
      // 필수적이지 않은 컨테이너는 인스턴스의 나머지 컨테이너에
      // 영향을 미치지 않고 종료되거나 충돌할 수 있다.
      "essential": false,
      // 컨테이너 전용으로 예약할 인스턴스 내 메모리
      // memory 또는 memoryReservation 중
      // 하나 또는 모두에 0이 아닌 정수를 지정한다.
      "memory": 128
    },
    {
      "name": "backend",
      "image": "jihogrammer/docker-backend",
      "hostname": "backend",
      "essential": false,
      "memory": 128
    },
    {
      "name": "nginx",
      "image": "jihogrammer/docker-nginx",
      "hostname": "nginx",
      "essential": true,
      // 컨테이너에 있는 네트워크 지점을 호스트에 있는 지점에 매핑
      "portMappings": [
        {
          "hostPort": 80,
          "containerPort": 80
        }
      ],
      // 연결할 컨테이너의 목록
      // 연결된 컨테이너는 서로를 검색하고 안전하게 통신 가능
      "links": ["frontend", "backend"],
      "memory": 128
    }
  ]
}
```

### 8. 다중 컨테이너 앱을 위한 Elastic Beanstalk 환경 생성

-   [docs](https://docs.aws.amazon.com/ko_kr/elasticbeanstalk/latest/dg/create_deploy_docker_v2config.html#create_deploy_docker_v2config_dockerrun)
-   [link](http://docker-fullstack-app-linux2-env.eba-6b8gngmf.ap-northeast-2.elasticbeanstalk.com)

### 9. VPC 설정하기

현재까지 운영 환경에서 DB를 위한 설정이 없다.
따라서 AWS의 RDS를 이용하여 MySQL을 애플리케이션과 연결해야 한다.
여기서 VPC와 Security Group을 설정해야 한다.

EB 인스턴스가 RDS(MySQL)에 접근하려면 VPC와 Security Group이 필요하다.
자동으로 연결되지 않으므로, 따로 설정해야 통신을 할 수 있다.

#### VPC

>   Amazon Virtual Private Cloud

AWS 클라우드에서 논리적으로 격리된 공간을 프로비저닝 해서
고객이 정의하는 가상 네트워크에서 AWS 리소스를 시작할 수 있다.

EC2 인스턴스나 EB 인스턴스 혹은 RDS가 있는 상태에서
이들을 하나의 그룹 안에서만 접근이 가능하도록 설정한다.
이를 설정함으로써 다른 아이디로 접근할 수 없도록 보호한다.

EB 인스턴스나 RDS를 생성하면 기본적으로 VPC(default)가 할당된다.
할당될 때 지역(region)별로 다르게 할당된다.
현재 기본적으로 할당된 VPC는 EB 인스턴스와 RDS를 포함한다.
하지만 설정을 따로 하지 않는 이상 서로 통신은 할 수 없다.
VPC 정보를 확인하기 위해서는 대시보드에서 VPC 검색해서 볼 수 있다.

#### Security Group(보안 그룹)

EC2 인스턴스와 외부 인스턴스 사이의 방화벽 정도로 생각하자.

-   inbound :
    외부에서 EC2 인스턴스나 EB 인스턴스로 요청을 보내는 트래픽이다.
    HTTP, HTTPS, SSH 등이 있다.
-   outbound :
    EC2 인스턴스나 EB 인스턴스 등에서 외부로 나가는 트래픽이다.
    파일을 다운로드 하거나
    inbound로 들어온 트래픽을 처리하여 응답하는 경우도 포함한다.

결론적으로 Security Group이 inbound와 outbound를 통제해서
트래픽을 열거나 닫을 수 있다.

#### 어떻게 VPC와 Security Group으로 통신하게 설정하는지

VPC 안에 있는 AWS 서비스 간 트래픽을 모두 허용할 수 있도록
Security Group을 허용한다.

### 10. MySQL을 위한 AWS RDS 생성하기

우선 `docker-compose.yml`에서 RDS 관련 설정을 지정한다.

```yml
backend:
  ...
  environment:
    MYSQL_HOST: mysql
    MYSQL_USER: root
    MYSQL_ROOT_PASSWORD: root1234
    MYSQL_DATABASE: myapp
    MYSQL_PORT: 3306
```

`db.js`에서 환경변수 읽어오는 설정으로 변경한다.

```js
const mysql = require("mysql");
const pool = mysql.createPool({
    connectionLimit: 10,
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_ROOT_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT
});

exports.pool = pool;
```

AWS에서 RDS 생성

-   RDS 검색
-   RDS 생성
    -   MySQL 선택
    -   RDS 이름 설정
    -   사용자(root) 설정
    -   기본 DB(myapp) 설정

### 11. Security Group 생성하기

1.  AWS Console에서 VPC 검색
2.  Security Group(보안 그룹) 선택
3.  보안 그룹 생성
    -   이름 및 설명 작성
    -   기타 설정은 그대로 둔 채 생성
4.  인바운드/아웃바운드 규칙 설정
    -   인바운드 : 외부에서 그룹에 접근할 때
        -   MySQL 추가를 위해 3306 포트를 연다.
        -   3번에서 생성한 보안 그룹을 지정한다.
    -   아웃바운드 : 그룹에서 외부로 나갈 때

### 12. Security Group 적용하기

#### RDS 설정

-   RDS에서 생성한 MySQL 수정 버튼 클릭하여 보안 그룹 수정
-   연결 탭에서 생성했던 보안그룹 선택
-   즉시 적용하여 최종 수정

#### EB 설정

-   적용할 EB 인스턴스에서 구성 > 인스턴스 편집
-   보안 그룹 추가
-   Warning은 무시하고 수정

### 13. EB와 RDS 소통을 위한 환경 변수 설정하기

아직 Elastic Beanstalk 안에 있는 컨테이너들이
MySQL 인스턴스와 소통할 때 환경변수를 인식하지 못한다.
그래서 AWS EB에 환경변수를 설정하여 그 문제를 해결한다.

-   적용할 EB 선택
-   구성에서 소프트웨어 편집
-   환경 속성에서 환경변수 지정
    -   AWS RDS에서 생성된 변수(엔드포인트)값 확인
    -   HOST 이름만 엔드포인트로 사용하고 나머지는 동일하게 지정

### 14. travis yml 파일 작성하기 (배포 부분)

```yml
deploy:
  # 외부 서비스 표시 (s3, elasticbeanstalk, firebase 등)
  provider: elasticbeanstalk
  # 현재 사용하고 있는 AWS의 서비스가 위치하고 있는 물리적 장소
  region: "ap-northeast-2"
  # 생성한 애플리케이션의 이름
  app: "docker-fullstack-app"
  # 생성한 애플리케이션의 환경 이름
  env: "docker-fullstack-app-Linux2-env"
  # 해당 elasticbeanstalk를 위한 s3 버켓 이름
  bucket_name: "elasticbeanstalk-ap-northeast-2-869075270387"
  # 애플리케이션 이름과 동일하게 설정
  bucket_path: "docker-fullstack-app"
  on:
    branch: master
```

이렇게 설정하고 끝이 아니다.
Travis CI가 AWS에 접근할 수 있도록 설정이 필요하다.

### 15. Travis CI의 AWS 접근을 위한 API Key 생성

소스 파일을 전달하기 위한 접근 요건 설정

-   "GitHub - Travis"는 Travis 홈페이지에서 인증
-   "Travis - AWS"는 AWS가 제공하는 Secret Key를 지정

7강에서 다룬 내용과 중복된다.

1.  AWS IAM USER 생성
    -   사용자 이름: docker-fullstack-user
    -   액세스 유형: 프로그래밍 방식 액세스
    -   기존 정책 중 "AdministratorAccess-AWSElasticBeanstalk" 지정
    -   태그는 생략했음
2. 발급된 Key를 Travis CI에서 환경변수로 설정
    -   이렇게 지정해야 키값을 노출하지 않는다.
3. .travis.yml에서 환경변수 매핑
    ```yml
    deploy:
      ...
      access_key_id: $AWS_ACCESS_KEY
      secret_access_key: $AWS_SECRET_ACCESS_KEY
    ```
