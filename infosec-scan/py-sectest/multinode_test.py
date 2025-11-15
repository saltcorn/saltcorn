from scsession import SaltcornSession
import logging

logging.basicConfig(
  level=logging.INFO,
  format='[%(asctime)s] %(levelname)s - %(message)s',
  datefmt='%Y-%m-%d %H:%M:%S'
)

logger = logging.getLogger(__name__)

email='admin@foo.com'
password='AhGGr6rhu45'

# function to login
def login(sess):
  sess.get('/auth/login')
  sess.postForm('/auth/login',
    {'email': email, 
    'password': password, 
    '_csrf':  sess.csrf()
    })

class Test:
  def setup_class(self):
    SaltcornSession.reset_to_fixtures()
    self.sess1 = SaltcornSession(port=3001, env_vars={
        "SALTCORN_MULTI_NODE": True,
    }, pipe_output=True)
    self.sess2 = SaltcornSession(port=3002, env_vars={
        "SALTCORN_MULTI_NODE": True,
    }, pipe_output=True)

  def teardown_class(self):
    self.sess1.close()
    self.sess2.close()


  # TEST 1:
  # create a table on sess1, and edit on sess2
  def test_edit_table(self):
    # 1. create on sess1
    logger.info("sess1 logging in")
    login(self.sess1)

    logger.info("Creating table")
    self.sess1.get('/table/new')
    self.sess1.postForm('/table', 
      {'name': 'multinode_test_table', 
      '_csrf':  self.sess1.csrf()
      })
    assert self.sess1.status == 302
    assert self.sess1.redirect_url.startswith('/table/')

    # 2. edit on sess2
    logger.info("sess2 logging in")
    login(self.sess2)

    logger.info((f"Following redirect {self.sess1.redirect_url}"))
    self.sess2.get(self.sess1.redirect_url)
    assert self.sess2.status == 200

    self.sess2.postForm('/table', 
      {'id': self.sess1.redirect_url.split('/')[2],
      'description': "Edited by sess2",
      'min_role_read': 1,
      'min_role_write': 1,
      'ownership_field_id': '',
      '_csrf':  self.sess2.csrf()
      })
    assert self.sess2.status == 302
    assert self.sess2.redirect_url == self.sess1.redirect_url


  # TEST 2:
  # create page on sess1 and try to open on sess2
  def test_edit_page(self):
    logger.info("test_edit_page")

    logger.info("sess1 logging in")
    login(self.sess1)

    logger.info("Creating page")
    self.sess1.get('/pageedit/new')
    self.sess1.postForm('/pageedit/edit-properties',
      {'name': 'page_from_sess1',
      'title': '',
      'description': '',
      'min_role': 1,
      'attributes.no_menu': 'false',
      'attributes.request_fluid_layout': 'false',
      '_csrf':  self.sess1.csrf()
      })

    assert self.sess1.status == 302

    login(self.sess2)
    self.sess2.get('/page/page_from_sess1')
    assert 'Page page_from_sess1 not found' not in self.sess2.content

  # create view on sess1 and try to open on sess2
  def test_edit_view(self):
    # 1. create on sess1
    logger.info("sess1 logging in")
    login(self.sess1)

    logger.info("Creating view")
    self.sess1.get('/viewedit/new')
    self.sess1.postForm('/viewedit/save',
      {'name': 'view_from_sess1',
      'viewtemplate': 'List',
      'table_name': 'albums',
      'min_role': '1',
      'description': '',
      'attributes.page_title': '',
      'attributes.page_description': '',
      'attributes.default_render_page': '',
      'attributes.slug': '',
      'attributes.popup_title': '',
      'attributes.popup_width': '',
      'attributes.popup_minwidth': '',
      '_csrf':  self.sess1.csrf()
      })
    assert self.sess1.status == 302
    assert self.sess1.redirect_url.startswith('/viewedit/config')

    # 2. open on sess2
    logger.info("sess2 logging in")
    login(self.sess2)
    self.sess2.get('/view/view_from_sess1')
    assert self.sess2.status == 200


  # TEST 3:
  # change site_name on sess1 and verify on sess2
  def test_edit_config(self):
    # 1. edit on sess1
    login(self.sess1)
    logger.info("sess1 logging in")
    self.sess1.get('/admin')
    self.sess1.postForm('/admin',
      {'site_name': 'New Sitename on Sess1',
      'timezone': 'Europe/Berlin',
      'default_locale': 'en',
      'base_url': '',
      'multitenancy_enabled': 'on',
      'site_logo_id': '',
      'favicon_id': '',
      'page_custom_css': '',
      'page_custom_html': '',
      'plugins_store_endpoint': 'https://store.saltcorn.com/api/extensions',
      'packs_store_endpoint': 'https://store.saltcorn.com/api/packs',
      'maintenance_mode_page': '',
      '_csrf':  self.sess1.csrf()
      })
    assert self.sess1.status == 302

    # verify site_name on sess1
    self.sess1.get('/')
    assert 'New Sitename on Sess1' in self.sess1.content

    # 2. verify site_name on sess2
    logger.info("sess2 logging in")
    login(self.sess2)
    self.sess2.get('/')
    assert self.sess2.status == 200
    assert 'New Sitename on Sess1' in self.sess2.content

  # TEST 4:
  # install plugin on sess1 and verify on sess2
  def test_install_plugin(self):
    # 1. install on sess1
    logger.info("sess1 logging in")
    login(self.sess1)

    logger.info("Installing plugin")
    self.sess1.get('/plugins')
    self.sess1.postForm('/plugins/install/any-bootstrap-theme',
      {'_csrf':  self.sess1.csrf()})
    assert self.sess1.status == 302
    self.sess1.get('/')
    assert '/plugins/public/any-bootstrap-theme@' in self.sess1.content

    # 2. verify on sess2
    logger.info("sess2 logging in")
    login(self.sess2)
    self.sess2.get('/')
    assert '/plugins/public/any-bootstrap-theme@' in self.sess2.content

  # TEST 5:
  # configure plugin on sess1 and verify on sess2
  def test_configure_plugin(self):
    # 1. install on sess1
    logger.info("sess1 logging in")
    login(self.sess1)

    logger.info("Configuring plugin")
    self.sess1.get('/plugins/configure/any-bootstrap-theme')
    self.sess1.postForm('/plugins/saveconfig/any-bootstrap-theme',
      {
        '_csrf': self.sess1.csrf(),
        'theme': 'flatly',
        'backgroundColor': '#ffffff',
        'backgroundColorDark': '#212529',
        'cardBackgroundColor': '#ffffff',
        'cardBackgroundColorDark': '#212529',
        'cardFooterBg': '#2c3e50',
        'cardFooterBgAlpha': '0.03',
        'cardFooterBgAlphaDark': '0.03',
        'cardFooterBgDark': '#2c3e50',
        'cardFooterText': '#2c3e50',
        'cardFooterTextDark': '#2c3e50',
        'cardHeaderBg': '#2c3e50',
        'cardHeaderBgAlpha': '0.03',
        'cardHeaderBgAlphaDark': '0.03',
        'cardHeaderBgDark': '#2c3e50',
        'cardHeaderText': '#2c3e50',
        'cardHeaderTextDark': '#2c3e50',
        'colorscheme': 'navbar-light',
        'danger': '#e74c3c',
        'dangerDark': '#e74c3c',
        'dark': '#7b8a8b',
        'info': '#3498db',
        'infoDark': '#3498db',
        'light': '#ecf0f1',
        'linkColor': '#007bff',
        'linkColorDark': '#007bff',
        'menu_style': 'Top Navbar',
        'mode': 'dark',
        'primary': '#2c3e50',
        'primaryDark': '#2c3e50',
        'sass_file_name': 'bootstrap.min.public.flatly.1763284502569.css',
        'sass_file_name_dark': 'bootstrap.min.public.flatly.1763284502569.dark.css',
        'secondary': '#95a5a6',
        'secondaryDark': '#95a5a6',
        'stepName': 'stylesheet',
        'success': '#18bc9c',
        'successDark': '#18bc9c',
        'theme': 'flatly',
        'toppad': '2',
        'warning': '#f39c12',
        'warningDark': '#f39c12',
        'contextEnc': '%7B%22dark%22%3A%22%237b8a8b%22%2C%22info%22%3A%22%233498db%22%2C%22mode%22%3A%22dark%22%2C%22fluid%22%3Afalse%2C%22dark%22%3A%22%23ecf0f1%22%2C%22theme%22%3A%22flatly%22%2C%22danger%22%3A%22%23e74c3c%22%2C%22toppad%22%3A2%2C%22css_url%22%3Anull%2C%22in_card%22%3Afalse%2C%22primary%22%3A%22%232c3e50%22%2C%22success%22%3A%22%2318bc9c%22%2C%22warning%22%3A%22%23f39c12%22%2C%22css_file%22%3Anull%2C%22fixedTop%22%3Afalse%2C%22infoDark%22%3A%22%233498db%22%2C%22linkColor%22%3A%22%23007bff%22%2C%22secondary%22%3A%22%2395a5a6%22%2C%22dangerDark%22%3A%22%23e74c3c%22%2C%22menu_style%22%3A%22Top%20Navbar%22%2C%22colorscheme%22%3A%22navbar-light%22%2C%22primaryDark%22%3A%22%232c3e50%22%2C%22successDark%22%3A%22%2318bc9c%22%2C%22warningDark%22%3A%22%23f39c12%22%2C%22cardFooterBg%22%3A%22%232c3e50%22%2C%22cardHeaderBg%22%3A%22%232c3e50%22%2C%22css_integrity%22%3Anull%2C%22linkColorDark%22%3A%22%23007bff%22%2C%22secondaryDark%22%3A%22%2395a5a6%22%2C%22cardFooterText%22%3A%22%232c3e50%22%2C%22cardHeaderText%22%3A%22%232c3e50%22%2C%22sass_file_name%22%3A%22bootstrap.min.public.flatly.1763284502569.css%22%2C%22backgroundColor%22%3A%22%23ffffff%22%2C%22include_std_bs5%22%3Afalse%2C%22cardFooterBgDark%22%3A%22%232c3e50%22%2C%22cardHeaderBgDark%22%3A%22%232c3e50%22%2C%22cardFooterBgAlpha%22%3A0.03%2C%22cardHeaderBgAlpha%22%3A0.03%2C%22cardFooterTextDark%22%3A%22%232c3e50%22%2C%22cardHeaderTextDark%22%3A%22%232c3e50%22%2C%22backgroundColorDark%22%3A%22%23212529%22%2C%22cardBackgroundColor%22%3A%22%23ffffff%22%2C%22sass_file_name_dark%22%3A%22bootstrap.min.public.flatly.1763284502569.dark.css%22%2C%22cardFooterBgAlphaDark%22%3A0.03%2C%22cardHeaderBgAlphaDark%22%3A0.03%2C%22cardBackgroundColorDark%22%3A%22%23212529%22%7D'
      }
    )
    assert self.sess1.status == 200
    self.sess1.get('/')
    assert 'data-bs-theme="dark"' in self.sess1.content

    # 2. verify on sess2
    logger.info("sess2 logging in")
    login(self.sess2)
    self.sess2.get('/')
    assert 'data-bs-theme="dark"' in self.sess2.content
