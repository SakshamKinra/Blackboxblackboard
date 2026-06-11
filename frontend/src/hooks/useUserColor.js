import { useState, useEffect } from 'react';

export function useUserColor(socket) {
  const [myColor, setMyColor] = useState('#C9A84C');
  const [myNumber, setMyNumber] = useState(1);
  const [myUserId, setMyUserId] = useState(null);
  const [activeUsers, setActiveUsers] = useState([]);

  useEffect(() => {
    if (!socket) return;

    const onJoined = ({ color, userNumber, userId }) => {
      setMyColor(color);
      setMyNumber(userNumber);
      setMyUserId(userId);
      localStorage.setItem('bb_user_color', color);
      localStorage.setItem('bb_user_id', userId);
    };

    const onUserList = ({ users }) => {
      setActiveUsers(users);
    };

    socket.on('joined_board', onJoined);
    socket.on('joined_whiteboard', onJoined);
    socket.on('user_list', onUserList);

    return () => {
      socket.off('joined_board', onJoined);
      socket.off('joined_whiteboard', onJoined);
      socket.off('user_list', onUserList);
    };
  }, [socket]);

  return { myColor, myNumber, myUserId, activeUsers };
}
