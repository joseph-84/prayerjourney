# 기도여정 (Prayer Journey)

천주교 신자를 위한 기도 생활 도우미 앱입니다.  
매일의 기도를 계획하고, 기록하고, 알림을 받을 수 있습니다.

---

## 주요 기능

### 🙏 홈 — 오늘의 기도
- 오늘 기도 목록을 구성하고 완료 여부를 체크
- 기도 항목마다 알림 시간과 요일(매일 또는 특정 요일) 설정 가능
- 완료율 진행 바 표시
- 월별 달력에서 날짜별 기도 완료 기록 조회 (전체 완료 / 절반 이상 / 일부 완료 표시)
- 기도문 또는 그룹을 목록에 추가·순서 변경·삭제

### 📖 라이브러리 — 기도문 보관함
- 카테고리별 기도문 목록 (주요기도, 묵주기도, 고해성사, 성체성사, 호칭기도, 여러가지기도, 레지오마리애)
- 즐겨찾기 기능
- **매일성경** 탭: 오늘의 독서 및 복음 본문 자동 로드
- 기도문을 오늘 기도 목록에 바로 추가 가능

### 👥 그룹 — 기도 묶음 관리
- 여러 기도문을 하나의 그룹으로 묶어 관리
- 그룹 기도 플레이어: 기도문을 순서대로 넘겨가며 묵상

### ⚙️ 설정
- **기도 알림**: 소리 / 진동 개별 설정
- **알림 액션 버튼**: 알림에서 바로 '확인'(닫기) 또는 '다시알림 5분' 선택 가능
- **데이터 내보내기**: 기도문·그룹·기록·설정을 JSON 파일로 기기에 저장
- **데이터 가져오기**: 저장된 JSON 백업 파일 불러오기
- **서버 백업**: 비밀번호 기반 클라우드 백업 및 복원

---

## 기술 스택

| 항목 | 사용 기술 |
|------|----------|
| 프레임워크 | React Native 0.83 + Expo 55 (Dev Client) |
| 언어 | TypeScript |
| 네비게이션 | React Navigation (Bottom Tabs) |
| 로컬 저장소 | react-native-mmkv |
| 알림 | @notifee/react-native |
| 파일 I/O | expo-file-system (StorageAccessFramework) |
| 문서 선택 | expo-document-picker |
| 서버 동기화 | n8n webhook + Supabase |

---

## 화면 구성

```
기도여정
├── 홈          — 오늘의 기도 목록 + 달력 기록
├── 라이브러리   — 기도문 목록 + 매일성경
├── 그룹        — 기도 그룹 관리 + 플레이어
└── 설정        — 알림 설정 + 백업/복원
```

---

## 시작하기

### 요구사항
- Node.js 18+
- Android SDK (또는 실제 Android 기기)
- Expo Dev Client 빌드

### 설치

```bash
git clone https://github.com/joseph-84/prayerjourney.git
cd prayerjourney
npm install
```

### 실행

```bash
# Metro 번들러 시작
npm start

# Android 빌드 및 실행
npm run android
```

### 아이콘 재생성 (선택)

```bash
# 아이콘 미리보기 생성
node scripts/generate-icon-b2.js

# 실제 mipmap 디렉터리에 적용
node scripts/generate-icon-b2.js apply
```

---

## 알림 권한 (Android)

Android 12 이상에서는 정확한 알람 권한이 필요합니다.  
앱 최초 실행 시 또는 설정에서 알림을 활성화할 때 자동으로 권한 요청 화면이 표시됩니다.

```xml
<!-- AndroidManifest.xml -->
<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM"/>
<uses-permission android:name="android.permission.USE_EXACT_ALARM"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
```

---

## 데이터 백업

### 로컬 파일 백업
설정 → 데이터 내보내기 → 기기의 원하는 폴더에 `기도여정-백업-YYYY-MM-DD.json` 저장  
설정 → 데이터 가져오기 → 저장된 JSON 파일 선택

### 서버 백업
비밀번호를 설정하여 서버에 암호화 백업.  
다른 기기에서 같은 비밀번호로 복원 가능.

---

## 라이선스

Private — 개인 프로젝트
