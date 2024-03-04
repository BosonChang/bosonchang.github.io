document.addEventListener('DOMContentLoaded', function() {
  const template = `
    <div class="card">
        <img src="img_avatar.png" alt="Avatar" style="width:100%">
        <div class="container">
            <h4><b>{name}</b></h4>
            <p>{content}</p>
        </div>
    </div>
  `;

  const generateTemplate = (name, content) => {
  const container = document.getElementById('cardsContainer');
  if (container) {
    const html = template.replace('{name}', name).replace('{content}', content);
    container.insertAdjacentHTML('beforeend', html);
  } else {
    console.error('Container element not found.');
  }
};

  // Usage
    generateTemplate('me.lobby', 'Where you can find things');
    
});
