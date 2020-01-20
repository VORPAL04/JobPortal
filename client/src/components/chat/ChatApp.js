import React from 'react';
import PropTypes from 'prop-types';
import io from 'socket.io-client';
import config from '../../config';
import Messages from './Messages';
import ChatInput from './ChatInput';
import chatActions from '../../redux/chat/chatActions';

class ChatApp extends React.Component {
  user = JSON.parse(localStorage.getItem('currentUser'));

  constructor(props) {
    super(props);
    this.setState({
      messages: [],
    });
    // set the initial state of messages so that it is not undefined on load
    this.state = {
      messages: [],
      chats: [],
    };
    // Connect to the server
    this.socket = io(config.nodeBaseUrl, { query: `username=${this.user.name}` }, { transports: ['websocket', 'polling'] }).connect();

    // Listen for messages from the server
    this.socket.on('server:message', (message) => {
      this.addMessage(message);
    });
    const { username } = this.props;
    const sender = this.user.name;
    const receiver = username;
    const { dispatch } = this.props;
    dispatch(chatActions.getMessages(sender, receiver));
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    if (nextProps.chats !== prevState.chats) {
      return {
        chats: nextProps.chats,
      };
    }
    return null;
  }

  componentDidUpdate(prevProps) {
    const { chats, username } = this.props;
    if (prevProps.chats !== chats) {
      try {
        const sender = this.user.name;
        const receiver = username;
        const senderMessage = [];
        const receiverMessage = [];
        chats.filter((item) => {
          if (item.sender === sender && item.receiver === receiver) {
            item.messages.map((chat, innerIndex) => {
              senderMessage[innerIndex] = {
                username: sender,
                to: receiver,
                message: chat[sender],
                date: chat.date,
                fromMe: true,
              };
              this.addMessage(senderMessage[innerIndex]);
              return true;
            });
          }
          if (item.sender === receiver && item.receiver === sender) {
            item.messages.map((chat, innerIndex) => {
              receiverMessage[innerIndex] = {
                username: receiver, to: sender, date: chat.date, message: chat[receiver],
              };
              this.addMessage(receiverMessage[innerIndex]);
              return true;
            });
          }
          return false;
        });
      } catch (error) {
        console.log(error.message);
      }
    }
  }

  sendHandler = (message) => {
    const { handleTyping, username } = this.props;
    if (message === true) {
      this.socket.emit('typing');
      this.socket.on('typing', (data) => {
        handleTyping(message, data);
        return () => {
          this.socket.disconnect();
        };
      });
    } else {
      const messageObject = {
        username: this.user.name,
        to: username,
        message,
      };

      // Dispatch the messages to redux action to be saved into db
      const sender = this.user.name;
      const receiver = username;
      const date = new Date().toString();
      const { dispatch } = this.props;
      dispatch(chatActions.saveMessage(sender, receiver, message, date));
      // Emit the message to the server
      this.socket.emit('client:message', messageObject);
      messageObject.fromMe = true;
      this.addMessage(messageObject);
    }
  };

  addMessage = (message) => {
    const { handleTyping } = this.props;
    // Append the message to the component state
    const { messages } = this.state;
    messages.push(message);
    messages.sort((a, b) => new Date(a.date) - new Date(b.date));
    this.setState({ messages });
    handleTyping(false, false);
    return true;
  };

  render() {
    const { username } = this.props;
    const { messages } = this.state;
    // Here we want to render the main chat application components
    return (
      <div className="container chat">
        <h3 className="chatTitle">{username}</h3>
        <Messages messages={messages} />
        <ChatInput onSend={this.sendHandler} />
      </div>
    );
  }
}

ChatApp.propTypes = {
  username: PropTypes.string.isRequired,
  dispatch: PropTypes.func.isRequired,
  chats: PropTypes.string.isRequired,
  handleTyping: PropTypes.func.isRequired,
};

export default ChatApp;
