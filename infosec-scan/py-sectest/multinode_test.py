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

    #2 open on sess2
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

    # verify site_name on sess2
    logger.info("sess2 logging in")
    login(self.sess2)
    self.sess2.get('/')
    assert self.sess2.status == 200
    assert 'New Sitename on Sess1' in self.sess2.content
