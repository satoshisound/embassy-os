import { Component } from '@angular/core'
import { ApiService } from 'src/app/services/api/api.service'
import { MarketplaceData, MarketplaceEOS, AvailablePreview } from 'src/app/services/api/api-types'

@Component({
  selector: 'app-available-list',
  templateUrl: './app-available-list.page.html',
  styleUrls: ['./app-available-list.page.scss'],
})
export class AppAvailableListPage {
  loading = true
  error = ''
  category = 'featured'
  searchFocused = false
  data: MarketplaceData
  eos: MarketplaceEOS
  pkgs: AvailablePreview[] = []

  constructor (
    private readonly apiService: ApiService,
  ) { }

  async ngOnInit () {
    try {
      const [data, eos, pkgs] = await Promise.all([
        this.apiService.getMarketplaceData({ }),
        this.apiService.getEos({ }),
        this.apiService.getAvailableList({ category: this.category }),
      ])
      this.data = data
      this.eos = eos
      this.pkgs = pkgs
    } catch (e) {
      console.error(e)
      this.error = e.message
    } finally {
      this.loading = false
    }
  }

  async getPkgs (e?: any): Promise<void> {
    this.loading = true
    const query = e && e.target.value
    try {
      this.pkgs = await this.apiService.getAvailableList({ category: this.category, query })
    } catch (e) {
      console.error(e)
      this.error = e.message
    } finally {
      this.loading = false
    }
  }
}
