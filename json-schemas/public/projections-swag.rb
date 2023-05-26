{
  type: :object,
  required: %w[data],
  properties: {
    data: {
      type: :object,
      required: %w[id type attributes],
      properties: {
        id: {
          type: :string,
          format: :number
        },
        type: {
          type: :string,
          enum: %w[projection]
        },
        attributes: {
          type: :object,
          required: %w[id new_player_id line_score created_at updated_at],
          properties: {
            id: {
              type: :number
            },
            new_player_id: {
              type: :number
            },
            line_score: {
              type: :number
            },
            risk_exposure: {
              type: %w[number null],
              default: nil
            },
            created_at: {
              type: :string,
              format: 'date-time'
            },
            updated_at: {
              type: :string,
              format: 'date-time'
            },
            start_time: {
              type: %w[string null],
              format: 'date-time',
              default: nil
            },
            description: {
              type: %w[string null],
              default: nil
            },
            status: {
              type: :number,
              default: 0
            },
            score_id: {
              type: %w[number null],
              default: nil
            },
            board_time: {
              type: %w[string null],
              format: 'date-time',
              default: nil
            },
            rank: {
              type: %w[number null],
              default: nil
            },
            league_id: {
              type: %w[number null],
              default: nil
            },
            is_promo: {
              type: :boolean,
              default: true
            },
            end_time: {
              type: %w[string null],
              format: 'date-time',
              default: nil
            },
            tv_channel: {
              type: %w[string null],
              default: nil
            },
            starting_pitcher: {
              type: %w[string null],
              default: nil
            },
            subleague_id: {
              type: %w[number null],
              default: nil
            },
            position_id: {
              type: %w[number null],
              default: nil
            },
            duration_id: {
              type: %w[number null],
              default: nil
            },
            game_id: {
              type: %w[string null],
              default: nil
            },
            stat_type_id: {
              type: %w[number null],
              default: nil
            },
            projection_type_id: {
              type: %w[number null],
              default: nil
            },
            refundable: {
              type: :boolean,
              default: true
            },
            flash_sale_line_score: {
              type: %w[number null],
              default: nil
            },
            custom_image: {
              type: %w[string null],
              default: nil
            },
            lock_version: {
              type: :number,
              default: 0
            },
            board_error_start: {
              type: %w[string null],
              format: 'date-time',
              default: nil
            },
            board_error_end: {
              type: %w[string null],
              format: 'date-time',
              default: nil
            },
            board_error_reason_id: {
              type: %w[number null],
              default: nil
            }
          }
        }
      }
    }
  }
}
