# 💻 Development & Architecture Context

## 기술 스택 (Tech Stack)
* **Frontend:** React, TypeScript, TailwindCSS
* **Backend:** Node.js (Express) 또는 Python (FastAPI)
* **Database:** PostgreSQL 또는 sqllite
* **Media Processing:** FFmpeg / FFmbc (메타데이터 추출 및 썸네일 생성용)

## 코딩 컨벤션 및 규칙
* **언어 규칙:** Frontend와 Backend 모두 TypeScript 사용을 권장하며, 엄격한 타입 검사(Strict Mode)를 활성화.
* **상태 관리:** 클라이언트 상태는 Zustand, 서버 상태(데이터 패칭)는 React Query를 사용.
* **API 응답 포맷:** 모든 REST API 응답은 아래 형태를 일관되게 유지할 것.
  ```json
  {
    "success": true,
    "data": {},
    "error": null
  }

## 📝 주석 및 문서화 (Commenting & Documentation)
* JSDoc / TSDoc 필수: 모든 주요 함수, 클래스, Custom Hook 작성 시 JSDoc 포맷(/** ... */)으로 파라미터(@param), 반환값(@returns), 그리고 함수의 목적을 명시할 것.

* 'Why' 중심의 주석: 코드가 '무엇(What)'을 하는지가 아니라, '왜(Why)' 그렇게 작성되었는지(예: 특정 우회 로직, 성능을 위한 최적화, 미디어 처리 시 특정 파라미터를 준 이유 등)를 비즈니스 로직 옆에 반드시 주석으로 남길 것.

* TODO & FIXME: 개선이 필요하거나 임시로 작성된 코드에는 // TODO: 또는 // FIXME: 태그를 달아 추후 리팩토링 시 추적할 수 있게 할 것.

## 🏗️ 아키텍처 및 디렉토리 구조 (Architecture & Structure)
* 관심사 분리 (Separation of Concerns): * Frontend: UI 렌더링(View)과 비즈니스/상태 로직(Logic)을 분리할 것. 복잡한 로직은 반드시 useCustomHook으로 빼내어 관리.

* Backend: 라우터(Router/Controller) ➡️ 비즈니스 로직(Service) ➡️ 데이터베이스 접근(Repository/DAO)의 3계층(Layered Architecture) 패턴을 엄격히 준수할 것.

* 모듈화: 하나의 파일에 300줄 이상의 코드가 작성되지 않도록 기능별로 잘게 쪼개어(Modular) 작성할 것.

## 🚨 예외 처리 및 검증 (Error Handling & Validation)
* 입력값 검증 (Validation): 백엔드 API 진입점과 프론트엔드 폼(Form) 제출 시, Zod 또는 Joi와 같은 스키마 검증 라이브러리를 사용하여 타입과 필수 값을 1차적으로 검증할 것.

* 비동기 프로세스 예외 처리: FFmpeg나 FFmbc 같은 무거운 외부 프로세스를 child_process 등으로 실행할 때, 프로세스 중단(Crash), 타임아웃, 메모리 초과 등에 대한 try-catch 예외 처리 및 stderr 로깅을 반드시 구현할 것.

* Global Error Handler: 백엔드에서는 일관된 에러 응답을 위해 전역 에러 처리 미들웨어를 두고, 정의된 API 응답 포맷(success: false)에 맞추어 에러 메시지와 코드를 반환할 것.

## 🔒 보안 및 성능 (Security & Performance)
* 미디어 최적화: 브라우저에서 무거운 오디오/비디오 데이터를 다룰 때 메인 스레드가 블로킹되지 않도록, 필요시 Web Worker 활용 방안을 고려하여 코드를 제안할 것.

* 타임아웃 및 메모리 관리: 대용량 파일 스트리밍/업로드 시 메모리 누수(Memory Leak)가 발생하지 않도록 Stream API를 적극 활용하고 적절한 타임아웃을 설정할 것.