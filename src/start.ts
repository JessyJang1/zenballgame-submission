import { prepareOpeningGeometry } from './assets/openingGeometryJob'
import { fetchOpeningPrograms } from './assets/openingPrograms'

const options = new URLSearchParams(location.search)
if (options.get('debug') !== 'court' && options.get('review') !== 'asset') {
  void prepareOpeningGeometry()
  fetchOpeningPrograms()
}
void import('./main').catch(error => {
  console.error('Game module failed to load', error)
  window.dispatchEvent(new Event('zenball-entry-failed'))
})
