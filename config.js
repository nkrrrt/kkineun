/*
 * 이 파일의 두 줄만 채우면 앱이 동작합니다.
 *
 * 둘 다 비밀번호가 아닙니다. 공개돼도 괜찮은 값이에요. 문을 지키는 건 이 값이
 * 아니라 구글 로그인과 시트 공유 명단입니다.
 */
var CONFIG = {
  // 1) 앱스 스크립트 배포 주소. .../exec 로 끝납니다.
  apiUrl: 'https://script.google.com/macros/s/AKfycbw8ZQ1wwp4PkAgpKXrilY70o2JIxf_ZH3z08szlzcrjVw5NFVSYSxXbdt-7FkLNHep7/exec',

  // 2) 구글 클라우드 콘솔에서 만든 웹 클라이언트 ID.
  //    ...apps.googleusercontent.com 으로 끝납니다.
  clientId: '1068313664202-3dhaov21ksrq2vaalvi32itidpkks58f.apps.googleusercontent.com'
};

/** 지금 돌고 있는 판. 설정 화면 맨 아래에 보인다. 고칠 때마다 올린다. */
var APP_VERSION = '20260831d';
