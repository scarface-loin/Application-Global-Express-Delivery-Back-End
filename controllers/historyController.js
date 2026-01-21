import { HistoryService } from '../services/historyService.js';

export class HistoryController {
  /**
   * Récupérer l'historique
   */
  static async getHistory(req, res) {
    try {
      const userId = req.user.uid;
      const { period = 'week' } = req.query;
      
      const history = await HistoryService.getDeliveryHistory(userId, period);
      
      res.json({
        success: true,
        data: history,
        period: period,
        totalDays: history.length
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Récupérer les statistiques
   */
  static async getStatistics(req, res) {
    try {
      const userId = req.user.uid;
      const statistics = await HistoryService.getStatistics(userId);
      
      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Récupérer les revenus mensuels
   */
  static async getMonthlyEarnings(req, res) {
    try {
      const userId = req.user.uid;
      const { year, month } = req.query;
      
      const currentDate = new Date();
      const targetYear = parseInt(year) || currentDate.getFullYear();
      const targetMonth = parseInt(month) || currentDate.getMonth() + 1;
      
      const earnings = await HistoryService.getMonthlyEarnings(userId, targetYear, targetMonth);
      
      res.json({
        success: true,
        data: earnings,
        year: targetYear,
        month: targetMonth
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}