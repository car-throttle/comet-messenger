const messages = module.exports = {};

messages.toMessage = function (message) {
  if (typeof message !== 'object') {
    if (typeof message === 'string') message = { type: 'text', text: message };
    else throw new Error('Invalid message');
  }

  var payload = {};

  switch (message.type) {

    case 'text':
      if (!message.text) throw new Error('Missing text property for text type');

      if (message.messenger_buttons) {
        payload = {
          attachment: {
            type: 'template',
            payload: {
              template_type: 'button',
              text: message.text,
              buttons: message.messenger_buttons.slice(),
            },
          },
        };
      }
      else {
        payload = {
          text: message.text,
        };
      }
      break;

    case 'image':
      if (!message.src) throw new Error('Missing src property for image type');

      payload = {
        attachment: {
          type: 'image',
          payload: {
            url: message.src,
          },
        },
      };
      break;

    default: throw new Error(`Invalid message type: "${message.type}"`);
  }

  if (Array.isArray(message.messenger_replies)) payload.quick_replies = message.messenger_replies.slice();

  return payload;
};
