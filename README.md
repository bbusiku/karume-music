# 카루메 뮤직

제공된 이미지 디자인을 바탕으로 만든 웹 뮤직 플레이어입니다. GitHub Pages에서 서버 없이 실행됩니다.

## 처음 사용하기

1. 앱의 **+** 버튼을 누르고 이용 안내에 동의합니다.
2. 유튜브 영상 링크를 붙여 넣어 **검색 → 추가**를 누릅니다. 링크 추가에는 API 키가 필요 없습니다.
3. 곡 목록에서 곡을 선택하거나 가운데 재생 버튼을 누릅니다.
4. 곡명 검색을 사용하려면 **+ → 검색 설정**에 YouTube Data API v3 키를 입력합니다.

[자세한 한글 안내](public/setup.html)에는 API 키 발급과 GitHub 배포 방법이 들어 있습니다. 이 안내 HTML은 파일을 직접 열어서 읽을 수 있습니다.

## GitHub Pages 배포

1. 새 저장소를 만들고 이 폴더의 **내용 전체**를 `main` 브랜치 최상위에 올립니다. ZIP 파일 자체를 올리는 것이 아닙니다.
2. `package.json`, `pnpm-lock.yaml`, `.npmrc`, `.github/workflows/pages.yml`, `app`, `lib`, `components`, `public`, `scripts` 등이 들어 있는지 확인합니다. 점으로 시작하는 경로가 누락되면 GitHub Desktop으로 폴더 전체를 커밋하거나 웹에서 파일 경로를 직접 생성하세요.
3. **Settings → Pages → Source → GitHub Actions**를 선택합니다.
4. **Actions → Publish music player to GitHub Pages → Run workflow**를 실행합니다.
5. 성공하면 Pages 설정에서 사이트 주소를 확인합니다. 이후 main 변경 때 자동 배포됩니다.

저장소 경로는 자동 적용됩니다. API 키를 코드나 GitHub에 올리지 않습니다. 플레이어 주소: https://bbusiku.github.io/karume-music/?embed=1

## 개발 및 검사

Node.js 24, pnpm 11.19.0을 설치하고 프로젝트 폴더에서 실행합니다.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm dev
```

표시된 HTTP 주소로 접속하세요. 앱은 `file://`로 실행하지 마세요.

```sh
pnpm test
pnpm typecheck
pnpm build
```

빌드 결과는 `dist/client`입니다. `.npmrc`는 의존성 설치 스크립트를 실행하지 않습니다. 빌드 래퍼는 Windows에서 네이티브 작업이 자연 종료되도록 하고 오류 종료는 그대로 유지합니다.

## 버튼 동작

- 곡 목록: 곡 선택, 전체/즐겨찾기 탭, 더 보기 메뉴에서 삭제 및 YouTube 열기.
- 하트: 즐겨찾기 등록/해제.
- 셔플: 현재 곡 유지, 다음 순서를 중복 없이 섞음. 끄면 추가 순서 복원.
- 이전/다음: 현재 순서로 이동, 양 끝에서 순환.
- 재생/일시정지: 공식 YouTube 플레이어의 실제 상태에 연결.
- 반복: 끔 → 한 곡 → 전곡 → 끔. 끔에서는 현재 곡이 끝나면 정지.
- 위 슬라이더: 음량. 아래 슬라이더: 실제 영상의 재생 위치.

목록·즐겨찾기·음량·반복·셔플은 현재 브라우저 localStorage에 저장되며 다른 기기로 동기화되지 않습니다. 검색 키는 현재 탭의 sessionStorage에만 보관합니다.

## YouTube 동작

공식 영상 플레이어가 화면에 표시됩니다. 목록/검색창을 열거나 다른 탭으로 이동하면 일시정지됩니다. 자동 재생이 막히면 재생 버튼을 다시 누르세요. 삭제·비공개·임베드 금지·지역/연령 제한은 앱에서 해제할 수 없습니다. 오류 시 YouTube 원본 링크를 제공합니다. 링크 정보 조회에 실패하면 영상 ID로 추가하고 재생 시작 시 실제 제목을 반영합니다.

## 구성

- `app/music-player.tsx`: 플레이어 화면 및 검색·목록
- `app/globals.css`: 이미지 기반 디자인과 반응형 스타일
- `lib/player.ts`: 목록/셔플/반복, URL, 검색 API
- `lib/use-music-player.ts`: 실제 YouTube 재생 및 브라우저 저장
- `tests/player.test.mjs`: 핵심 동작 자동 검사
- `public/karume-reference.png`: 제공받은 원본 이미지. 파일은 변경하지 않고 CSS로 필요한 영역을 표시.
- `public/setup.html`: 설정 안내
- `.github/workflows/pages.yml`: 자동 검사·빌드·배포

## 확인 범위

상태 로직 및 검색 오류 자동 검사, TypeScript 검사, 정적 배포 빌드를 확인했습니다. 실제 API 키가 없어 실서비스 곡명 검색은 확인하지 않았습니다. 브라우저 클릭/음향 종단 간 검사는 수행하지 않았습니다. WebMCP는 지원 브라우저에서 곡 목록 조회 및 즐겨찾기 전환 도구를 등록합니다. 지원되는 검증 컨텍스트가 없어 해당 도구의 실브라우저 계약 검증은 수행하지 않았습니다.

## 공식 자료

- [YouTube API 시작](https://developers.google.com/youtube/v3/getting-started)
- [YouTube 검색 API](https://developers.google.com/youtube/v3/docs/search/list)
- [공식 영상 플레이어](https://developers.google.com/youtube/iframe_api_reference)
- [API 키 제한](https://docs.cloud.google.com/docs/authentication/api-keys)
- [GitHub Pages 자동 배포](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)

## 노션 임베드

GitHub Pages 배포 후 주소 끝에 `?embed=1`을 붙여 노션의 `/embed` 블록에 입력합니다.

예시(본인의 주소로 변경): `https://YOURNAME.github.io/karume-music/?embed=1`

HTML iframe 코드가 아니라 URL을 입력합니다. 가로 700px / 높이 480px 정도로 블록을 넓히면 원본처럼 두 칸으로 표시됩니다. 좁은 칼럼에서는 세로 배치와 내부 스크롤을 사용합니다. 창 안에서 실행되면 임베드 모드가 자동 적용됩니다.

로그인이 필요한 비공개 Sites 주소 대신 공개 GitHub Pages 주소를 사용하세요. 노션 데스크톱/모바일 앱은 외부 로그인이 필요한 임베드를 지원하지 않을 수 있습니다. 노션과 외부 브라우저의 저장소가 분리되므로 곡 목록과 검색 키를 따로 설정해야 할 수 있습니다. 재생은 직접 버튼을 누르며, 노션의 실제 프레임 권한 및 영상별 제한에 영향을 받습니다. 노션 내 실제 음향 재생은 아직 검증하지 않았습니다.

[노션 공식 안내](https://www.notion.com/help/embed-and-connect-other-apps)
