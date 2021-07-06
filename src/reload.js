const socket = new WebSocket('ws://localhost:8080');
socket.addEventListener('message', (event) => {
  console.log(event);
  if (event.data === 'reload') {
    window.location.reload();
  }
});
