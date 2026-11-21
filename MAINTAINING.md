# 배포 관리

`main`의 원본 파일 URL을 설치·업데이트 경로로 사용합니다. 별도의 GitHub Pages 사이트나 API 서버는 필요하지 않습니다.

| 목적 | 파일 |
| --- | --- |
| 설치·업데이트 코드 다운로드 | `boj-group-practice-tier.user.js` |
| 새 버전 확인 | `boj-group-practice-tier.meta.js` |
| 사용자 안내 | `README.md`, `INSTALL.ko.txt` |

## 새 버전 게시

1. 실행 코드를 수정하고 변경에 맞는 검증을 수행합니다.
2. `.user.js`의 `@version`을 이전보다 높은 값으로 올립니다.
3. `// ==UserScript==`부터 `// ==/UserScript==`까지의 헤더를 `.meta.js`에 그대로 복사합니다. 두 파일의 헤더는 완전히 같아야 합니다.
4. 배포 파일에 실제 키, 계정 정보, 저장소 백업이 없는지 확인합니다.
5. 코드·메타데이터·관련 안내를 같은 커밋으로 `main`에 게시합니다.
6. 로그인하지 않은 상태에서도 두 raw URL이 HTTP 200이고 올바른 내용을 반환하는지 확인합니다. GitHub CDN 캐시 때문에 변경 반영에 시간이 걸릴 수 있습니다.

현재 고정 주소:

```text
https://raw.githubusercontent.com/planPt/boj-group-practice-tier/main/boj-group-practice-tier.user.js
https://raw.githubusercontent.com/planPt/boj-group-practice-tier/main/boj-group-practice-tier.meta.js
```

`@name`, `@namespace`, 키 저장소 이름을 불필요하게 변경하지 마세요. 기존 사용자의 스크립트 식별과 설정 유지에 영향을 줄 수 있습니다. 업데이트 주소는 이미 설치된 사용자들이 사용하므로 파일 이름과 배포 브랜치도 유지합니다.

Tampermonkey가 설치된 코드의 업데이트 주소를 따라 새 코드를 받을 수 있습니다. 저장소 변경 권한을 신뢰할 수 있는 관리자에게만 부여하고 코드 검토 후 게시하세요.

## 문제가 생겼을 때

단순히 낮은 버전으로 되돌리는 대신 수정된 코드를 더 높은 버전으로 게시합니다. 그래야 기존 사용자의 업데이트 검사에서도 수정본을 발견할 수 있습니다.

사용자 Secret, Tampermonkey 저장소 내보내기, 로컬 설정, 비공개 테스트 화면은 이 저장소에 올리지 않습니다. 공개 오류 제보에서도 키를 요구하지 않습니다.
