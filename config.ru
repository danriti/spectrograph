# This is the root of our app
@root = File.expand_path(File.dirname(__FILE__))

use Rack::Static,
  :urls => ["/images", "/js", "/css"],
  :root => @root

run lambda { |env|
  [
    200,
    {
      'Content-Type'  => 'text/html',
      'Cache-Control' => 'public, max-age=86400'
    },
    File.open('index.html', File::RDONLY)
  ]
}
